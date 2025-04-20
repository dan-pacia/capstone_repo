import pymongo
from datetime import datetime, timedelta


def get_distinct_days_from_adsb() -> list:
    """
    Connects to the MongoDB database and returns a sorted list of distinct days
    (in YYYY-MM-DD format) found in the 'properties.timestamp' field stored as ISO strings.

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
                    "$substrBytes": ["$properties.timestamp", 0, 10]
                }
            }
        },
        {
            "$match": {
                "day": { "$regex": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }
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


def get_distinct_times_from_adsb(day):
    """
    Returns a list of distinct times (HH:MM:SS) from 'properties.timestamp'
    for a given day when timestamps are ISO strings.

    Args:
        day (str): Date string in 'YYYY-MM-DD' format.

    Returns:
        List of strings representing distinct times, sorted chronologically.
        Returns an empty list if no data is found.
    """
    client = pymongo.MongoClient("127.0.0.1", 27017)
    db = client.adsb_db
    collection = db.api_data

    pipeline = [
        {
            "$match": {
                "properties.timestamp": {
                    "$regex": f"^{day}T"
                }
            }
        },
        {
            "$project": {
                "time": {
                    "$substr": ["$properties.timestamp", 11, 8]
                }
            }
        },
        {
            "$group": {
                "_id": "$time"
            }
        },
        {
            "$sort": {
                "_id": 1
            }
        }
    ]

    result = list(collection.aggregate(pipeline))
    return [doc["_id"] for doc in result]


def get_data_window_for_date(date_str, start_time_str, window_seconds=1):
    """
    Queries MongoDB for documents in a specific time window using ISO 8601 timestamp strings.

    Args:
        date_str (str): Date in 'YYYY-MM-DD' format.
        start_time_str (str): Time in 'HH:MM:SS' format.
        window_seconds (int): Number of seconds in the window.
    
    Returns:
        List of documents within the specified time window.
    """
    # Create datetime objects
    start_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M:%S")
    end_dt = start_dt + timedelta(seconds=window_seconds)

    # Convert to ISO 8601 strings (UTC format with "Z")
    start_iso = start_dt.isoformat() + "Z"
    end_iso = end_dt.isoformat() + "Z"

    print("Mongo query (ISO timestamps):", start_iso, end_iso)

    # Connect to MongoDB
    host = "127.0.0.1"
    port = 27017
    client = pymongo.MongoClient(host, port)
    db = client.adsb_db
    collection = db.api_data

    # Query documents within the time window
    cursor = collection.find({
        "properties.timestamp": {
            "$gte": start_iso,
            "$lte": end_iso
        }
    })

    return list(cursor)
