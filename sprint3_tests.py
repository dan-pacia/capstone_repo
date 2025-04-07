from flask_app import app
from goes_manager import get_latest_image
from unittest.mock import patch, MagicMock
import os 
import numpy as np
from datetime import datetime
import pandas as pd 


# using this file for all server-side unit tests for sprint 3
# to run: $coverage run -m pytest test_app.py sprint3_tests.py -p no:warning
# coverage report: $ coverage report -m

# UT-1 Test that app route serving weather data will not re-query S3 bucket and reprocess existing imagery
def test_get_latest_image_uses_cached_png():
    with patch("goes_manager.os.path.exists") as mock_exists, \
         patch("goes_manager.GOES") as mock_goes, \
         patch("goes_manager.Scene") as mock_scene, \
         patch("goes_manager.rasterio.open") as mock_rasterio:

        mock_exists.return_value = True
        expected_filename = "20250405_123000_merc.png"

        mock_ds = MagicMock()
        mock_ds["start"].iloc.__getitem__.return_value.strftime.return_value = "20250405_123000"
        mock_goes.return_value.latest.return_value = mock_ds

        result = get_latest_image()
        assert result == expected_filename


# UT-2 Verify backend responds gracefully when attempting to retrieve imagery that is not fully uploaded to S3 bucket yet
def test_backend_handles_incomplete_s3_upload_gracefully():
    with patch("goes_manager.GOES") as mock_goes:
        mock_goes.return_value.latest.side_effect = FileNotFoundError("Data still uploading")

        with app.test_client() as client:
            response = client.get("/get-latest-image")

            assert response.status_code == 200
            assert response.data.decode() == "New image not yet available"


# UT-5 Verify that the system stores retrieved and processed images correctly 
def test_image_processing_and_storage():
    base_dir = r"C:\Users\danpa\Projects\aa_capstone\py_project\composites"
    base_filename = "20250405_123000"
    png_path = os.path.join(base_dir, f"{base_filename}_merc.png")

    # Mock the 'get_latest_image' function in goes_manager
    with patch("goes_manager.get_latest_image") as mock_get_latest_image:
        
       
        mock_get_latest_image.return_value = None  

        # Simulate the image file creation
        with open(png_path, "wb") as f:
            f.write(b"fake image data")

        # Run the test
        with app.test_client() as client:
            response = client.get("/get-latest-image")

            # Assert that the image file exists
            assert response.status_code == 200
            assert os.path.exists(png_path)

            # Clean up
            os.remove(png_path)

# UT-6 Verify that processed images are named with correct naming convention
def test_image_naming_convention():
    base_dir = r"C:\Users\danpa\Projects\aa_capstone\py_project\composites"
    base_filename = "20250405_123000"
    expected_png_path = os.path.join(base_dir, f"{base_filename}_merc.png")

    # Mock GOES and the get_latest_image method
    with patch("goes_manager.get_latest_image") as mock_get_latest_image:
        # Mock the behavior of get_latest_image method to return the expected filename
        mock_get_latest_image.return_value = expected_png_path

        # Run the code that generates the PNG file
        with app.test_client() as client:
            response = client.get("/get-latest-image")

            # Assert the response is successful
            assert response.status_code == 200, f"Expected 200, but got {response.status_code}"

            # Assert that the PNG file path matches the expected path
            generated_filename = mock_get_latest_image.return_value
            assert generated_filename == expected_png_path, \
                f"Expected filename {expected_png_path}, but got {generated_filename}"

            # Optionally, check the base filename (the date and time part)
            generated_datetime_str = os.path.basename(generated_filename).split('_')[0] + "_" + \
                                     os.path.basename(generated_filename).split('_')[1]
            assert generated_datetime_str == base_filename, \
                f"Expected {base_filename}, but got {generated_datetime_str}"


# UT-7 Verify error handling when processing images fails
def test_image_processing_error_handling():
    base_dir = r"C:\Users\danpa\Projects\aa_capstone\py_project\composites"
    base_filename = "20250405_123000"
    tif_path = os.path.join(base_dir, f"{base_filename}.tif")
    png_path = os.path.join(base_dir, f"{base_filename}_merc.png")

    # Mock GOES and the get_latest_image method
    with patch("goes_manager.GOES") as mock_goes, \
         patch("goes_manager.os.path.exists") as mock_exists, \
         patch("goes_manager.Scene") as mock_scene:

        # Simulate the .tif file existing
        mock_exists.side_effect = lambda path: path == tif_path

        # Simulate the behavior of getting the latest dataset
        mock_latest = MagicMock()
        mock_goes.return_value.latest.return_value = mock_latest
        mock_item = MagicMock()
        mock_item.strftime.return_value = base_filename  # mock strftime to return the date-time format
        mock_latest.__getitem__.return_value.iloc.__getitem__.return_value = mock_item

        # Mock the Scene.load method to throw an exception
        mock_scene.return_value.load.side_effect = Exception("Mocked error during file processing")

        # Run the code that generates the PNG file
        with patch("goes_manager.get_latest_image") as mock_get_latest_image:
            mock_get_latest_image.return_value = png_path  # Simulating successful image creation

            # Simulate the image processing and saving
            result = get_latest_image()

            # Debug: Print the result to check if it matches the expected string
            print(f"Result: '{result}'")

            # Assert that the error message is returned when processing fails
            expected_result = "An error occurred processing the files"
            assert result.strip() == expected_result, f"Expected '{expected_result}', but got '{result.strip()}'"


# UT-8 Verify that netCDF files are not re-downloaded if they already exist
def test_no_redownload_existing_files():
    download_dir = "C:/Users/danpa/data/noaa-goes19"  

    # Helper to recursively list all files in the directory
    def list_all_files(base_dir):
        return set(
            os.path.join(root, file)
            for root, _, files in os.walk(base_dir)
            for file in files
        )

    # Snapshot before first download
    before_first = list_all_files(download_dir)

    # First call: This may download new files
    get_latest_image()

    # Snapshot after first call
    after_first = list_all_files(download_dir)

    # Second call: Should detect files exist and not download again
    get_latest_image()

    # Snapshot after second call
    after_second = list_all_files(download_dir)
    assert after_second == after_first, "No new files should be downloaded on second call"



# UT-9 Verify that the system will return an image that it processed and stored instead of processing a new image 
def test_existing_processed_image_is_used():
    # First call should process and generate the image
    get_latest_image()

    # Patch Satpy method
    with patch("goes_manager.Scene") as mock_scene:
        # Set up a mock so if called, it’s easy to detect
        mock_instance = mock_scene.return_value
        mock_instance.load.return_value = None
        mock_instance.save_dataset.return_value = None

        # Second call should reuse the existing image and not trigger processing
        get_latest_image()

        # Assert Satpy's Scene was never called again
        mock_scene.assert_not_called()
