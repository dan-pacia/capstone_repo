import folium

def create_map_iframe():
    """Create a Folium map and return its iframe representation."""
    m = folium.Map()

    # Set the iframe width and height
    m.get_root().width = "1000px"
    m.get_root().height = "500px"

    # Return the iframe representation
    return m.get_root()._repr_html_()