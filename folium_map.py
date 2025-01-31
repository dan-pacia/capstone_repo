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

def test_update_map(df):

    lat_arr = df["latitude"].to_numpy()
    lon_arr = df["longitude"].to_numpy()
    heading_arr = df["heading"].to_numpy()

    usa_center = [37.0902, -95.7129]  # Latitude, Longitude
    zoom_level = 4  # Zoom level (lower values zoom out, higher values zoom in)

    m = folium.Map(location=usa_center, zoom_start=zoom_level)

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
