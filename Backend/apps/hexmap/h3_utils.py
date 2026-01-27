"""
H3 utility functions
"""
import h3
from django.conf import settings
from shapely.geometry import Point, Polygon, shape
from shapely.prepared import prep


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


def is_point_in_bounds(lat: float, lng: float, bounds: dict) -> bool:
    """
    Check if a point is within the game area bounds
    
    Args:
        lat: Latitude
        lng: Longitude
        bounds: GeoJSON polygon or dict with coordinates
               Format: {"type": "Polygon", "coordinates": [[[lng, lat], ...]]}
               or {"coordinates": [[[lng, lat], ...]]}
    
    Returns:
        True if point is inside bounds, False otherwise
    """
    if not bounds:
        return True  # No bounds defined = allow all
    
    try:
        # Create point (shapely uses lng, lat order)
        point = Point(lng, lat)
        
        # Create polygon from bounds
        if 'type' in bounds and bounds['type'] == 'Polygon':
            # GeoJSON format
            polygon = shape(bounds)
        elif 'coordinates' in bounds:
            # Simple coordinates format
            coords = bounds['coordinates']
            if isinstance(coords, list) and len(coords) > 0:
                # GeoJSON polygon has outer ring as first element
                outer_ring = coords[0] if isinstance(coords[0][0], list) else coords
                polygon = Polygon(outer_ring)
            else:
                return True
        else:
            return True  # Unknown format, allow
        
        return polygon.contains(point)
    except Exception:
        # If parsing fails, allow (fail open)
        return True


def is_h3_in_bounds(h3_id: str, bounds: dict) -> bool:
    """
    Check if an H3 hex is within the game area bounds
    
    Args:
        h3_id: H3 index string
        bounds: GeoJSON polygon or dict with coordinates
    
    Returns:
        True if hex center is inside bounds, False otherwise
    """
    if not bounds:
        return True  # No bounds defined = allow all
    
    try:
        # Get hex center
        lat, lng = h3.h3_to_geo(h3_id)
        return is_point_in_bounds(lat, lng, bounds)
    except Exception:
        return True  # If parsing fails, allow


# Cache for prepared polygons (for faster repeated checks)
_bounds_cache = {}


def get_prepared_polygon(bounds: dict):
    """
    Get or create a prepared polygon for faster repeated checks
    
    Args:
        bounds: GeoJSON polygon or dict with coordinates
    
    Returns:
        Prepared polygon or None
    """
    if not bounds:
        return None
    
    # Create cache key from bounds
    cache_key = str(bounds)
    
    if cache_key in _bounds_cache:
        return _bounds_cache[cache_key]
    
    try:
        if 'type' in bounds and bounds['type'] == 'Polygon':
            polygon = shape(bounds)
        elif 'coordinates' in bounds:
            coords = bounds['coordinates']
            if isinstance(coords, list) and len(coords) > 0:
                outer_ring = coords[0] if isinstance(coords[0][0], list) else coords
                polygon = Polygon(outer_ring)
            else:
                return None
        else:
            return None
        
        # Prepare polygon for faster repeated contains checks
        prepared = prep(polygon)
        _bounds_cache[cache_key] = prepared
        return prepared
    except Exception:
        return None


def is_point_in_prepared_bounds(lat: float, lng: float, prepared_polygon) -> bool:
    """
    Check if a point is within prepared polygon bounds (faster for repeated checks)
    
    Args:
        lat: Latitude
        lng: Longitude
        prepared_polygon: Prepared polygon from get_prepared_polygon()
    
    Returns:
        True if point is inside bounds, False otherwise
    """
    if prepared_polygon is None:
        return True
    
    try:
        point = Point(lng, lat)
        return prepared_polygon.contains(point)
    except Exception:
        return True

