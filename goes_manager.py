from goes2go import GOES 
from satpy import Scene
from satpy.writers import geotiff
import os 
from datetime import datetime
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling


def get_latest_image():

    dl_dir = r"C:\Users\danpa\data"
    comps_dir = r"C:\Users\danpa\Projects\aa_capstone\py_project\composites"

    desired_product = "ABI-L1b-RadC"
    desired_ds = "colorized_ir_clouds"

    G = GOES(satellite=16, product=desired_product, domain='C')

    ds = G.latest(return_as = "filelist")

    file_date = ds["start"].iloc[0]

    time_string = file_date.strftime("%Y%m%d_%H%M%S")

    filenames = ds["file"].to_list()

    filenames = [os.path.join(dl_dir, fn) for fn in filenames]

    scn = Scene(reader = "abi_l1b", filenames = filenames)

    scn.load([desired_ds])    

    savename = os.path.join(comps_dir, time_string + ".tif")

    scn.save_dataset(desired_ds, filename = savename)

    print(f"Saved dataset to: {savename}")

    # re-load the image we just saved and reproject with rasterio
    dst_crs = "EPSG:3857"

    input_file = savename
    output_file = os.path.join(comps_dir, time_string + "_merc" + ".tif")

    # can we pass xarray objects instead of writing to file? 
    with rasterio.open(input_file) as src:
        transform, width, height = calculate_default_transform(
        src.crs, dst_crs, src.width, src.height, *src.bounds
        )

        kwargs = src.meta.copy()
        kwargs.update({
            "crs": dst_crs,
            "transform": transform,
            "width": width,
            "height": height
            })

        with rasterio.open(output_file, "w", **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear
                )

    # final step is to convert to png or jpeg :)

    return output_file










