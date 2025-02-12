import pytest
from unittest.mock import patch, MagicMock
from flask import Flask
from flask_app import app  # Import the Flask app
import json

@pytest.fixture
def client():
    """Fixture to set up the test client."""
    with app.test_client() as client:
        yield client

def test_iframe_page_loads(client): # ut-1
    """Test that the iframe page loads successfully."""
    response = client.get("/")
    assert response.status_code == 200

def test_api_call_valid_bbox(client): # ut-2
    """Test that the API returns a valid GeoJSON object."""
    
    # Define a valid bounding box within limits
    bbox = "34.0,35.0,-118.0,-117.0"
    save_data = 0  # Do not save data in this test
    
    response = client.get(f"/api-call/{bbox}/{save_data}")

    # Assert response status is 200 OK
    assert response.status_code == 200

    # Load JSON response
    data = json.loads(response.data)

    # Ensure it follows GeoJSON structure
    assert isinstance(data, dict)
    assert "type" in data and data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)

    # If there are features, check their structure
    if data["features"]:
        feature = data["features"][0]
        assert "type" in feature and feature["type"] == "Feature"
        assert "geometry" in feature
        assert "properties" in feature

    print("test_api_call_valid_bbox passed")

EMPTY_GEOJSON = json.dumps({"type": "FeatureCollection", "features": []})

# ut-3
@patch("flask_app.get_os_states", return_value=EMPTY_GEOJSON)  # Simulate failure of get_os_states
def test_api_call_invalid_get_os_states(mock_get_os_states, client):
    """Test that the API handles an invalid response from get_os_states properly.
    
    TypeError: The view function for 'get_states' did not return a valid response. The function either 
    returned None or ended without a return statement.
    """

    bbox = "34.0,35.0,-118.0,-117.0"
    save_data = 0  

    response = client.get(f"/api-call/{bbox}/{save_data}")

    # The API should return a valid response, even if get_os_states fails
    assert response.status_code == 200  # Ensure the route still responds
    data = json.loads(response.data)

    # The response should not be None or empty
    assert isinstance(data, dict)

    # Ideally, we should expect the API to handle it and return a default structure
    assert "type" in data and data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)

    # If get_os_states fails, there should be no features
    assert len(data["features"]) == 0  

    print("test_api_call_invalid_get_os_states passed")

# ut-6
@patch("flask_app.collection.insert_many")  # Mock the MongoDB collection
@patch("flask_app.get_os_states", return_value=json.dumps({
    "type": "FeatureCollection",
    "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [-118.0, 34.0]}, "properties": {}}]
}))  # Mock API response
def test_api_call_inserts_data(mock_get_os_states, mock_insert_many, client):
    """Test that data is inserted into MongoDB when save_data == 1."""

    bbox = "34.0,35.0,-118.0,-117.0"
    save_data = 1  

    response = client.get(f"/api-call/{bbox}/{save_data}")

    assert response.status_code == 200
    data = json.loads(response.data)

    # Ensure the API still returns a valid GeoJSON
    assert "type" in data and data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)
    assert len(data["features"]) > 0  # Data should exist

    # Ensure insert_many was called once with the correct data
    mock_insert_many.assert_called_once_with(data["features"])

    print("test_api_call_inserts_data passed")

#UT-5
@patch("flask_app.collection.insert_many", side_effect=Exception("Database Error"))  # Simulate DB failure
@patch("flask_app.get_os_states", return_value=json.dumps({
    "type": "FeatureCollection",
    "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [-118.0, 34.0]}, "properties": {}}]
}))  # Mock API response
def test_api_call_handles_db_error(mock_get_os_states, mock_insert_many, client):
    """Test that database errors are handled gracefully when inserting data."""

    bbox = "34.0,35.0,-118.0,-117.0"
    save_data = 1  

    response = client.get(f"/api-call/{bbox}/{save_data}")

    assert response.status_code == 200
    data = json.loads(response.data)

    # Ensure API still returns valid GeoJSON despite DB error
    assert "type" in data and data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)

    # Ensure insert_many was called but threw an exception
    mock_insert_many.assert_called_once()

    print("test_api_call_handles_db_error passed")

# UT-7
@pytest.mark.parametrize("bbox", [
    "34.0,35.0,-118.0",  # Missing one coordinate
    "34.0,35.0,-118.0,-117.0,-116.0",  # Extra coordinate
    "34.0,abc,-118.0,-117.0",  # Non-numeric value
    ",35.0,-118.0,-117.0",  # Missing value
    "34.0,35.0, , ",  # Only spaces instead of values
])
def test_api_call_invalid_bbox(client, bbox):
    """Test that the API returns a 400 error when given an invalid bounding box format."""
    
    save_data = 0  
    response = client.get(f"/api-call/{bbox}/{save_data}")

    assert response.status_code == 400  # Ensure the API returns a Bad Request
    data = json.loads(response.data)

    assert "error" in data
    assert data["error"] == "Invalid bounding box format"

    print(f"test_api_call_invalid_bbox passed for bbox: {bbox}")

# UT-8
@pytest.mark.parametrize("bbox", [
    "34.0,35.0,-118.0,-117.0",  # Small bounding box
    "40.0,45.0,-90.0,-85.0",  # Another valid range
])
def test_api_call_valid_data_within_bbox(client, bbox):
    """Test that all returned points from the API fall within the provided bounding box."""
    
    save_data = 0  
    response = client.get(f"/api-call/{bbox}/{save_data}")

    assert response.status_code == 200  # Ensure the API successfully responds
    data = json.loads(response.data)

    assert "type" in data and data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)

    if len(data["features"]) > 0:
        min_lat, max_lat, min_lng, max_lng = map(float, bbox.split(","))

        for feature in data["features"]:
            assert "geometry" in feature
            assert "coordinates" in feature["geometry"]

            lon, lat = feature["geometry"]["coordinates"]  # GeoJSON uses [lon, lat]
            
            # Ensure each point falls within the given bounding box
            assert min_lat <= lat <= max_lat, f"Latitude {lat} out of bounds"
            assert min_lng <= lon <= max_lng, f"Longitude {lon} out of bounds"

    print(f"test_api_call_valid_data_within_bbox passed for bbox: {bbox}")
