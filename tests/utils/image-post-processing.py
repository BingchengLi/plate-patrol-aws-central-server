from PIL import Image
import piexif
from datetime import datetime
import os

def add_metadata(image_path, lat, lon, timestamp=None):
    """Add GPS and timestamp metadata to image"""
    # Create EXIF structure
    exif_dict = {
        "0th": {},
        "Exif": {},
        "GPS": {},
        "1st": {},
        "thumbnail": None
    }

    # Add GPS metadata (required format)
    exif_dict["GPS"][piexif.GPSIFD.GPSLatitudeRef] = b'N' if lat >= 0 else b'S'
    exif_dict["GPS"][piexif.GPSIFD.GPSLatitude] = _deg_to_dms(abs(lat))
    exif_dict["GPS"][piexif.GPSIFD.GPSLongitudeRef] = b'E' if lon >= 0 else b'W'
    exif_dict["GPS"][piexif.GPSIFD.GPSLongitude] = _deg_to_dms(abs(lon))

    # Add timestamp
    dt = timestamp or datetime.now()
    exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = dt.strftime("%Y:%m:%d %H:%M:%S")

    # Save with metadata
    exif_bytes = piexif.dump(exif_dict)
    with Image.open(image_path) as img:
        img.save("tests/assets/test-image-processed.jpg", exif=exif_bytes)

def read_metadata(image_path):
    """Read and print metadata"""
    exif_dict = piexif.load(Image.open(image_path).info["exif"])
    
    # GPS conversion
    lat = _dms_to_deg(exif_dict["GPS"][piexif.GPSIFD.GPSLatitude])
    lat_ref = exif_dict["GPS"][piexif.GPSIFD.GPSLatitudeRef]
    lat = -lat if lat_ref == b'S' else lat
    
    lon = _dms_to_deg(exif_dict["GPS"][piexif.GPSIFD.GPSLongitude])
    lon_ref = exif_dict["GPS"][piexif.GPSIFD.GPSLongitudeRef]
    lon = -lon if lon_ref == b'W' else lon
    
    # Timestamp
    dt = exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal].decode()
    
    print(f"GPS Coordinates: {lat:.6f}, {lon:.6f}")
    print(f"Timestamp: {dt}")

def _deg_to_dms(deg):
    """Convert decimal degrees to DMS tuple"""
    d = int(deg)
    m = int((deg - d) * 60)
    s = (deg - d - m/60) * 3600
    return [(d,1), (m,1), (int(s*1000),1000)]

def _dms_to_deg(dms):
    """Convert DMS tuple to decimal degrees"""
    return dms[0][0]/dms[0][1] + \
           dms[1][0]/dms[1][1]/60 + \
           dms[2][0]/dms[2][1]/3600

# Usage
add_metadata("tests/assets/test-image-raw.jpg", 40.7128, -74.0060)
read_metadata("tests/assets/test-image-processed.jpg")
