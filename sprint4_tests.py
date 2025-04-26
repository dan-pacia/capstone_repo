import re
import os 
import pytest
from datetime import datetime, timedelta
from mongo_manager import get_distinct_days_from_adsb, get_distinct_times_from_adsb, get_data_window_for_date
import rasterio
from goes_manager import get_latest_image
from unittest.mock import patch

# generate coverage report
# pytest -v --cov=mongo_manager --cov=goes_manager --cov-report=term-missing sprint4_tests.py

# UT-1: Test that the days with available dates can be retrieved from the database
def test_get_distinct_days_from_adsb():
    # Step 1: Call the function
    result = get_distinct_days_from_adsb()

    # Step 2: Assert the length matches expected number of days
    expected_number_of_days = 18  
    assert len(result) == expected_number_of_days, f"Expected {expected_number_of_days} dates, got {len(result)}"

    # Step 3: Assert each date matches YYYY-MM-DD format
    date_format_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for date in result:
        assert date_format_regex.match(date), f"Date '{date}' is not in 'YYYY-MM-DD' format"

# UT-2 Test that timestamps for specific day can be accurately retrieved from database
def test_get_distinct_times_from_adsb():
    # Step 1: Call the function with a known date
    test_day = "2025-04-18" 
    result = get_distinct_times_from_adsb(test_day)

    # Step 2: Assert the length matches the known number of timestamps
    expected_number_of_timestamps = 87  
    assert len(result) == expected_number_of_timestamps, (
        f"Expected {expected_number_of_timestamps} timestamps, got {len(result)}"
    )

    # Step 3: Assert each timestamp is in HH:MM:SS format
    time_format_regex = re.compile(r"^\d{2}:\d{2}:\d{2}$")
    for time in result:
        assert time_format_regex.match(time), f"Time '{time}' is not in 'HH:MM:SS' format"

# UT-3 Test that documents can be retrieved from database correctly with query on “properties.timestamp” 
def test_get_data_window_for_date():
    # Step 1: Provide known inputs
    test_date = "2025-04-18" 
    start_time = "22:13:14"
    window_seconds = 1

    # Construct datetime boundaries for assertion
    start_dt = datetime.strptime(f"{test_date} {start_time}", "%Y-%m-%d %H:%M:%S")
    end_dt = start_dt + timedelta(seconds=window_seconds)

    # Step 2: Call the function
    results = get_data_window_for_date(test_date, start_time, window_seconds)

    # Assert at least one document was returned (optional sanity check)
    assert len(results) > 0, "No documents returned for the specified time window"

    # Step 3: Check each document's timestamp
    for doc in results:
        ts_str = doc["properties"]["timestamp"]
        ts_dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%SZ")

        assert start_dt <= ts_dt <= end_dt, (
            f"Timestamp {ts_dt} not within window {start_dt} to {end_dt}"
        )

# UT-4 Test that the system will correctly retrieve historic weather imagery
def test_get_latest_image_metadata():
    # Step 1: Call the function with a known date and time
    test_datetime = "2025-04-18_221215"  
    output_filename = get_latest_image(test_datetime)

    # Construct the full path to the output image
    comps_dir = r"C:\Users\danpa\Projects\aa_capstone\py_project\composites"
    png_path = os.path.join(comps_dir, output_filename)

    # Assert that the output file exists
    assert os.path.exists(png_path), f"Output file {png_path} does not exist."

    # Step 2: Open the image and verify dimensions
    with rasterio.open(png_path) as src:
        width = src.width
        height = src.height

        # Step 3: Assert that dimensions match expected values
        expected_width = 2553
        expected_height = 1408
        assert width == expected_width, f"Expected width {expected_width}, got {width}"
        assert height == expected_height, f"Expected height {expected_height}, got {height}"

# UT-5 Test that system will not re-download netCDF files from s3 bucket if the files were already downloaded
def test_no_redownload_existing_files():
    download_dir = "C:/Users/danpa/data/noaa-goes19"  

    # Helper to recursively list all files in the directory
    def list_all_files(base_dir):
        return set(
            os.path.join(root, file)
            for root, _, files in os.walk(base_dir)
            for file in files
        )

    test_datetime = "2025-04-18_221215" 

    # Snapshot before first download
    before_first = list_all_files(download_dir)

    # First call: This may download new files
    get_latest_image(test_datetime)

    # Snapshot after first call
    after_first = list_all_files(download_dir)

    # Second call: Should detect files exist and not download again
    get_latest_image(test_datetime)

    # Snapshot after second call
    after_second = list_all_files(download_dir)
    assert after_second == after_first, "No new files should be downloaded on second call"

# UT-6 Test that system will not re-process an image it has already processed and stored
def test_existing_processed_image_is_used():
    test_datetime = "2025-04-18_221215" 
    # First call should process and generate the image
    get_latest_image(test_datetime)

    # Patch Satpy method
    with patch("goes_manager.Scene") as mock_scene:
        # Set up a mock so if called, it’s easy to detect
        mock_instance = mock_scene.return_value
        mock_instance.load.return_value = None
        mock_instance.save_dataset.return_value = None

        # Second call should reuse the existing image and not trigger processing
        get_latest_image(test_datetime)

        # Assert Satpy's Scene was never called again
        mock_scene.assert_not_called()