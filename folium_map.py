import folium

def create_map_iframe():
    """Create a Folium map and return its iframe representation."""
    usa_center = [37.0902, -95.7129]  # Latitude, Longitude
    zoom_level = 4  # Zoom level (lower values zoom out, higher values zoom in)

    m = folium.Map(location=usa_center, zoom_start=zoom_level)

    # Set the iframe width and height
    m.get_root().width = "1000px"
    m.get_root().height = "500px"

    # Return the iframe representation
    return m.get_root()._repr_html_()

def test_update_map(lat_arr, lon_arr):
    usa_center = [37.0902, -95.7129]  # Latitude, Longitude
    zoom_level = 4  # Zoom level (lower values zoom out, higher values zoom in)

    m = folium.Map(location=usa_center, zoom_start=zoom_level)

    for i in range(len(lat_arr)):
        folium.Marker((lat_arr[i], lon_arr[i]), icon=folium.Icon("blue")).add_to(m)

        # Set the iframe width and height
    m.get_root().width = "1000px"
    m.get_root().height = "500px"

    # Return the iframe representation
    return m.get_root()._repr_html_()
