from flask import Flask, render_template, jsonify, send_from_directory
import geopandas as gpd
from opensky_manager import get_os_states
from goes_manager import get_latest_image
from mongo_manager import get_day_timerange_from_adsb, get_distinct_days_from_adsb
import pymongo
import json
import os 

host = "127.0.0.1"
port = 27017

# mongodb connection
client = pymongo.MongoClient(host, port)
db = client.adsb_db
collection = db.api_data


app = Flask(__name__)

IMAGE_FOLDER = os.path.join(os.getcwd(), 'composites')


@app.route("/") # serve "index" page with iframe
def iframe_page():
    return render_template("iframe.html")

@app.route("/map_iframe") # URL for this route in iframe of index page
def map_iframe():
    return render_template("map_iframe.html")

@app.route("/get-data") # load from file for testing to reduce API calls
def get_data():
    gdf = gpd.read_file("dataframe.geojson")
    return gdf.to_json()

@app.route("/get-latest-image") # load weather image from file
def get_test_image():
    latest_img = get_latest_image()

    if latest_img == "Latest Data not yet available":
        return "New image not yet available" 

    return latest_img

@app.route("/get-latest-image/<path:filename>")
def serve_image(filename):
    return send_from_directory(IMAGE_FOLDER, filename)

@app.route("/api-call/<bbox>/<save_data>")
def get_states(bbox, save_data): 
    """
    Fetch states within the given bounding box, enforcing a size limit.
    bbox: list where: min_lat, max_lat, min_lng, max_lng
    save_data: int, 1 to insert, 0 otherwise
    """
    try:
        save_data = int(save_data) # is passed as string from client
        min_lat, max_lat, min_lng, max_lng = map(float, bbox.split(","))

        min_lat = round(min_lat, 4)
        max_lat = round(max_lat, 4)
        min_lng = round(min_lng, 4)
        max_lng = round(max_lng, 4)

        # Define max allowed bounding box size
        MAX_LAT_DIFF = 10.0  # Maximum latitude range
        MAX_LNG_DIFF = 10.0  # Maximum longitude range

        if (max_lat - min_lat) > MAX_LAT_DIFF or (max_lng - min_lng) > MAX_LNG_DIFF:
            return {"error": "Bounding box size exceeds limit"}, 400
        
        rounded_bbox = [min_lat, max_lat, min_lng, max_lng]
        # print("Rounded BBOX:", rounded_bbox)  # Debugging output
        json_states = get_os_states(rounded_bbox)

        if not json_states: # if api returns none
            return {"error": "Failed to retrieve data"}, 200

        if save_data == 1:
            try:
                states_in = json.loads(json_states)
                collection.insert_many(states_in["features"])
            except Exception as e:
                print("Error inserting to database", e)

        return json_states

    except ValueError:
        return {"error": "Invalid bounding box format"}, 400

@app.route("/populate-dates")
def populate_dates():
    """Populate list with available dates for ADS-B data """
    # list of available dates
    available_dates = get_distinct_days_from_adsb()
    return {"datesList": available_dates}


if __name__ == "__main__":
    app.run(debug=True)