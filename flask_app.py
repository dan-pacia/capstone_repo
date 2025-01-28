from flask import Flask, render_template
from folium_map import create_map_iframe

app = Flask(__name__)

@app.route("/iframe")
def iframe():
    """Embed a map as an iframe on a page."""
    iframe = create_map_iframe()
    return render_template("iframe.html", iframe=iframe)

if __name__ == "__main__":
    app.run(debug=True)