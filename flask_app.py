from flask import Flask, render_template, jsonify
from folium_map import create_map_iframe, test_update_map
from opensky_manager import get_conus_states

app = Flask(__name__)

@app.route("/")
def iframe():
    """Embed a map as an iframe on a page."""
    iframe = create_map_iframe()
    return render_template("iframe.html", iframe=iframe)

@app.route("/say-hello", methods=["GET"])
def hello_world():
    print("hello world")
    return jsonify({"message": "hello world"})

@app.route("/test-plot", methods=["GET", "POST"])
def test_plot(): # call test update map function
    df = get_conus_states()
    iframe = test_update_map(df)
    return {"iframe": iframe}


if __name__ == "__main__":
    app.run(debug=True)