"""
H3 utility functions
"""
import h3
from django.conf import settings


def latlng_to_h3(lat: float, lng: float, res: int = None) -> str:
    """
    Convert latitude/longitude to H3 index
    
    Args:
        lat: Latitude
        lng: Longitude
        res: H3 resolution (defaults to settings.H3_DEFAULT_RESOLUTION)
    
    Returns:
        H3 index string
    """
    if res is None:
        res = settings.H3_DEFAULT_RESOLUTION
    return h3.geo_to_h3(lat, lng, res)


def h3_to_latlng(h3_id: str) -> tuple:
    """
    Convert H3 index to latitude/longitude
    
    Args:
        h3_id: H3 index string
    
    Returns:
        (latitude, longitude) tuple
    """
    return h3.h3_to_geo(h3_id)


def get_h3_neighbors(h3_id: str, k: int = 1) -> list:
    """
    Get H3 neighbors (k-ring)
    
    Args:
        h3_id: H3 index string
        k: Ring distance (default: 1)
    
    Returns:
        List of H3 index strings
    """
    return h3.k_ring(h3_id, k)


def get_h3_edge_length_m(res: int) -> float:
    """
    Get average hexagon edge length in meters for a given resolution
    
    Args:
        res: H3 resolution
    
    Returns:
        Edge length in meters
    """
    return h3.edge_length(res, unit='m')


def get_h3_area_km2(res: int) -> float:
    """
    Get average hexagon area in km² for a given resolution
    
    Args:
        res: H3 resolution
    
    Returns:
        Area in km²
    """
    return h3.hex_area(res, unit='km^2')

