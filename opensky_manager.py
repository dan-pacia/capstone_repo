from opensky_api import OpenSkyApi
import pandas as pd
import geopandas as gpd
import json


# https://opensky-network.org/api/states/all?lamin=21&lomin=-136&lamax=50&lomax=-61
# note, can call api in same way with this


def get_os_states(bbox):
    """
    Fetch states within the given bounding box from the OpenSky API.

    Parameters:
    bbox: list [min_latitude, max_latitude, min_longitude, max_longitude]

    Returns:
    GeoJSON object containing flight state data.
    If no data is available, returns an empty GeoJSON FeatureCollection.
    """
    try: 
        api = OpenSkyApi()  # entire USA: 21, 50, -136, -61
        s = api.get_states(bbox=(bbox[0], bbox[1], bbox[2], bbox[3]))

        # If no positions are found, return an empty GeoJSON object
        if s is None or not s.states:
            return json.dumps({
                "type": "FeatureCollection",
                "features": []
            })

        dict_list = [i.__dict__ for i in s.states]
        df = pd.DataFrame(dict_list)
        df["timestamp"] = s.time

        # Convert to GeoDataFrame
        gdf = gpd.GeoDataFrame(
            df, 
            geometry=gpd.points_from_xy(df.longitude, df.latitude), 
            crs="EPSG:3857"
        )
        # remove un-needed columns:
        cols_to_drop = ["time_position", "last_contact", "vertical_rate", 
                        "sensors", "squawk", "spi", "position_source"]
        gdf.drop(columns = cols_to_drop, inplace = True)

        # convert timestamp (unix) to datetime
        gdf["timestamp"] = pd.to_datetime(gdf["timestamp"], unit = "s").dt.strftime("%Y-%m-%d %H:%M:%S")

        # handle null values (set to 0)
        for col in gdf.columns:
            gdf[col] = gdf[col].fillna(0)
        
        return gdf.to_json()
    
    except Exception as e:
        print("An error occured:", e)
        return None




