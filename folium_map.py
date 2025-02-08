import folium
from folium import JsCode
import folium.plugins


# def create_map_iframe(): # add center and zoom as
#     """Create a Folium map and return its iframe representation."""
#     map_center = [38.8, -76.8]  # Latitude, Longitude
#     zoom_level = 6  # Zoom level (lower values zoom out, higher values zoom in)

#     m = folium.Map(location=map_center, zoom_start=zoom_level)

#     # Set the iframe width and height
#     m.get_root().width = "1000px"
#     m.get_root().height = "500px"

#     m.get_root().html.add_child(folium.Element('<script>var adsb_map = map;</script>'))
#     # Return the iframe representation
#     return m.get_root()._repr_html_()

def create_map_iframe():
    """Create a Folium map and save it as an HTML file for iframe embedding."""
    map_center = [38.8, -76.8]
    zoom_level = 6

    m = folium.Map(location=map_center, zoom_start=zoom_level)
    # can likely call get name if needed :)
    m._name = "folium_map"
    m._id = "1"

    # Save the map to a file
    map_file = "static/map.html"  # Ensure Flask serves this file from /static

    m.save(map_file)  # Save map as a standalone HTML file

    return "/static/map.html"  # Return the path to the saved map

def test_update_map(df):

    lat_arr = df["latitude"].to_numpy()
    lon_arr = df["longitude"].to_numpy()
    heading_arr = df["heading"].to_numpy()

    map_center = [38.8, -76.8]  # Latitude, Longitude
    zoom_level = 6  # Zoom level (lower values zoom out, higher values zoom in)

    m = folium.Map(location=map_center, zoom_start=zoom_level)

    for i in range(len(lat_arr)):
        marker_html = f"""
        <div style="font-size: 16px; color: gold; transform: translate(-50%, -50%) rotate({heading_arr[i]}deg);">
            <i class="fa fa-plane"></i>
        </div>
        """
        folium.Marker((lat_arr[i], lon_arr[i]), icon=folium.DivIcon(
                html=marker_html),).add_to(m)

        # Set the iframe width and height
    m.get_root().width = "1000px"
    m.get_root().height = "500px"

    # Return the iframe representation
    return m.get_root()._repr_html_()



def realtime_map():
    """
    Notes: 
        folium needs get_feature_id to identify and update objects plotted
        it will "just go" if the response from the url is geojson... ours is not :(
        we need to make a feature collection of valid geojson features. This is returned by our javascript function.
    
    """
    # Center of the map (USA)
    usa_center = [77, 38.9]  # Latitude, Longitude
    zoom_level = 6  # Zoom level (lower values zoom out, higher values zoom in)

    # Create the map
    m = folium.Map(location=usa_center, zoom_start=zoom_level)

    # Define the Realtime plugin
    # note: github issues says the plugin cant poll from local files :)
    rt = folium.plugins.Realtime(
        source = JsCode("""
            async function getOpenSkyApi() {
            const url = 'https://opensky-network.org/api/states/all?lamin=38.5&lomin=-77.6&lamax=39&lomax=-78';
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Response status: $(response.status)");
                }
            const data = await response.json();
            } catch (error) {
                console.error(error.message)
            }
            const geojson = {
                "type": "FeatureCollection", 
                "features": []
            };
            var statesLen = data.states.length
            for (var i = 0; i < statesLen; i++) { // going to hard code for now, can dynamically assign later :) (if needed)
                var thisState = data.states[i]
                var feature = {
                    "type": "Feature", 
                    "geometry": {
                        "type": "Point", 
                        "coordinates": [thisState[5], thisState[6]]
                    }, 
                    "properties": {
                        "icao24": thisState[0], 
                        "callsign": thisState[1],
                        "origin_country": thisState[2], 
                        "time_position": thisState[3], 
                        "last_contact": thisState[4], 
                        "baro_altitude": thisState[7], 
                        "on_ground": thisState[8], 
                        "velocity": thisState[9], 
                        "heading": thisState[10],
                        "vertical_rate": thisState[11], 
                        "sensors": thisState[12], 
                        "geo_altitude": thisState[13],
                        "squawk": thisState[14],  
                        "spi": thisState[15], 
                        "position_source": thisState[16]
                    }
                }
                geojson.features.push(feature)
            }
            return geojson
        }
        """),
        get_feature_id=JsCode("""
            function(feature) {return feature[0];}
        """),
        interval=5000
    )

    rt.add_to(m)

    return m._repr_html_()