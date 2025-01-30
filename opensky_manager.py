from opensky_api import OpenSkyApi
import pandas as pd

def get_conus_states():
    """ 
    Connect to the OpenSky API and query for all positions
    in a rough bounding box around the continental United States.
    Returns a pandas dataframe with positions. 
    """

    api = OpenSkyApi()
    s = api.get_states(bbox = (21, 50, -136, -61))
    if s == None: # if no positions, just return
        return 

    dict_list = [i.__dict__ for i in s.states]

    df = pd.DataFrame(dict_list)

    df["timestamp"] = s.time

    return df


