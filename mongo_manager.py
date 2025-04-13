import pymongo
from datetime import datetime, timedelta


def get_distinct_days_from_adsb() -> list:
    """
    Connects to the MongoDB database and returns a sorted list of distinct days
    (in YYYY-MM-DD format) found in the 'properties.timestamp' field.

    Returns:
        Sorted list of unique days in 'YYYY-MM-DD' format.
    """
    host = "127.0.0.1"
    port = 27017
    
    client = pymongo.MongoClient(host, port)
    db = client.adsb_db
    collection = db.api_data

    pipeline = [
        {
            "$project": {
                "day": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": {
                            "$toDate": {
                                "$multiply": [
                                    {
                                        "$convert": {
                                            "input": "$properties.timestamp",
                                            "to": "long",
                                            "onError": None,
                                            "onNull": None
                                        }
                                    },
                                    1000
                                ]
                            }
                        }
                    }
                }
            }
        },
        {
            "$match": {
                "day": { "$ne": None }  # filter out failed conversions
            }
        },
        {
            "$group": {
                "_id": "$day"
            }
        },
        {
            "$sort": {
                "_id": 1
            }
        }
    ]


    results = collection.aggregate(pipeline)
    return [doc["_id"] for doc in results]



def get_day_timerange_from_adsb(day):
    """
    Returns the earliest and latest time (HH:MM:SS) from 'properties.timestamp'
    for a given day in the adsb_data collection.

    Args:
        day (str): Date string in 'YYYY-MM-DD' format.

    Returns:
        Tuple (earliest_time, latest_time) as strings
    """
    host = "127.0.0.1"
    port = 27017
    
    client = pymongo.MongoClient(host, port)
    db = client.adsb_db
    collection = db.api_data

    # Convert input day to datetime range
    start_dt = datetime.strptime(day, "%Y-%m-%d")
    end_dt = start_dt + timedelta(days=1)

    # Convert to Unix timestamps
    start_ts = int(start_dt.timestamp())
    end_ts = int(end_dt.timestamp())

    pipeline = [
        {
            "$project": {
                "timestamp": {
                    "$convert": {
                        "input": "$properties.timestamp",
                        "to": "long",
                        "onError": None,
                        "onNull": None
                    }
                }
            }
        },
        {
            "$match": {
                "timestamp": { "$gte": start_ts, "$lt": end_ts }
            }
        },
        {
            "$group": {
                "_id": None,
                "min_ts": { "$min": "$timestamp" },
                "max_ts": { "$max": "$timestamp" }
            }
        }
    ]

    result = list(collection.aggregate(pipeline))
    if not result:
        return None

    min_dt = datetime.utcfromtimestamp(result[0]["min_ts"]).strftime("%H:%M:%S")
    max_dt = datetime.utcfromtimestamp(result[0]["max_ts"]).strftime("%H:%M:%S")

    return (min_dt, max_dt)


