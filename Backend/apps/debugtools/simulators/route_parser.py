"""
Route parser for simulation
"""
import json
from typing import List, Dict, Tuple


class RouteParser:
    """Parse route files (JSON/GeoJSON)"""
    
    @staticmethod
    def parse_json_route(file_path: str) -> Dict:
        """
        Parse JSON route file
        
        Expected format:
        {
          "name": "Route Name",
          "waypoints": [
            {"lat": 37.5665, "lng": 126.9780},
            ...
          ],
          "metadata": {
            "total_distance_m": 1500,
            "estimated_duration_sec": 600
          }
        }
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'waypoints' not in data:
            raise ValueError("Route file must contain 'waypoints' field")
        
        return {
            'name': data.get('name', 'Unnamed Route'),
            'waypoints': data['waypoints'],
            'metadata': data.get('metadata', {})
        }
    
    @staticmethod
    def parse_geojson_route(file_path: str) -> Dict:
        """
        Parse GeoJSON route file
        
        Expected format: GeoJSON LineString
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if data.get('type') != 'FeatureCollection':
            raise ValueError("GeoJSON must be FeatureCollection")
        
        # Find LineString feature
        line_string = None
        for feature in data.get('features', []):
            if feature.get('geometry', {}).get('type') == 'LineString':
                line_string = feature['geometry']['coordinates']
                break
        
        if not line_string:
            raise ValueError("GeoJSON must contain a LineString feature")
        
        # Convert [lng, lat] to [lat, lng]
        waypoints = [{'lat': coord[1], 'lng': coord[0]} for coord in line_string]
        
        return {
            'name': data.get('properties', {}).get('name', 'Unnamed Route'),
            'waypoints': waypoints,
            'metadata': {}
        }
    
    @staticmethod
    def interpolate_waypoints(waypoints: List[Dict], interval_m: float = 10.0) -> List[Dict]:
        """
        Interpolate waypoints to create smoother path
        
        Args:
            waypoints: List of {lat, lng} dicts
            interval_m: Interpolation interval in meters
        
        Returns:
            Interpolated waypoints
        """
        from math import radians, cos, sin, asin, sqrt
        
        def haversine_distance(lat1, lng1, lat2, lng2):
            """Calculate distance between two points in meters"""
            R = 6371000  # Earth radius in meters
            dlat = radians(lat2 - lat1)
            dlng = radians(lng2 - lng1)
            a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
            c = 2 * asin(sqrt(a))
            return R * c
        
        def interpolate_point(lat1, lng1, lat2, lng2, fraction):
            """Interpolate between two points"""
            return {
                'lat': lat1 + (lat2 - lat1) * fraction,
                'lng': lng1 + (lng2 - lng1) * fraction
            }
        
        if len(waypoints) < 2:
            return waypoints
        
        interpolated = [waypoints[0]]
        
        for i in range(len(waypoints) - 1):
            p1 = waypoints[i]
            p2 = waypoints[i + 1]
            
            distance = haversine_distance(p1['lat'], p1['lng'], p2['lat'], p2['lng'])
            num_segments = int(distance / interval_m)
            
            if num_segments > 0:
                for j in range(1, num_segments + 1):
                    fraction = j / (num_segments + 1)
                    interpolated.append(interpolate_point(
                        p1['lat'], p1['lng'],
                        p2['lat'], p2['lng'],
                        fraction
                    ))
            
            interpolated.append(p2)
        
        return interpolated

