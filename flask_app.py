from flask import Flask, render_template, jsonify
from folium_map import create_map_iframe, test_update_map, realtime_map
import geopandas as gpd
from opensky_manager import get_os_states
import pymongo
import json

host = "127.0.0.1"
port = 27017

# mongodb connection
client = pymongo.MongoClient(host, port)
db = client.adsb_db
collection = db.api_data


app = Flask(__name__)


@app.route("/") # serve "index" page with iframe
def iframe_page():
    return render_template("iframe.html")

@app.route("/map_iframe") # URL for this route in iframe if index page
def map_iframe():
    return render_template("map_iframe.html")

@app.route("/get-data") # load from file for testing to reduce API calls
def get_data():
    gdf = gpd.read_file("dataframe.geojson")
    return gdf.to_json()

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
        print("Rounded BBOX:", rounded_bbox)  # Debugging output
        json_states = get_os_states(rounded_bbox)

        if save_data == 1:
            states_in = json.loads(json_states)
            collection.insert_many(states_in["features"])

        return json_states

    except ValueError:
        return {"error": "Invalid bounding box format"}, 400



if __name__ == "__main__":
    app.run(debug=True)