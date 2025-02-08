from opensky_api import OpenSkyApi
import pandas as pd
import geopandas as gpd


# https://opensky-network.org/api/states/all?lamin=21&lomin=-136&lamax=50&lomax=-61
# note, can call api in same way with this

def get_os_states(bbox):
    """

    bbox: [min_latitude, max_latitude, min_longitude, max_longitude]
    """
    
    api = OpenSkyApi() # entire USA 21, 50, -136, -61
    s = api.get_states(bbox = (bbox[0], bbox[1], bbox[2], bbox[3]))
    if s == None: # if no positions, just return
        return # refactor, return json message

    dict_list = [i.__dict__ for i in s.states]

    df = pd.DataFrame(dict_list)

    df["timestamp"] = s.time

    gdf = gpd.GeoDataFrame(
        df, geometry = gpd.points_from_xy(df.longitude, df.latitude), 
        crs = "EPSG:3857")

    return gdf.to_json()

