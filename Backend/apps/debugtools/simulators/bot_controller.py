"""
Bot controller for simulation
"""
import asyncio
import random
import math
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from math import radians, cos, sin, asin, sqrt, atan2, degrees
from .websocket_client import SimulatorWebSocketClient
from .route_parser import RouteParser


class BotController:
    """Controls a bot that follows a route"""
    
    def __init__(
        self,
        bot_id: int,
        route: Dict,
        websocket_client: SimulatorWebSocketClient,
        speed_mps: float = 2.8,
        tick_interval_sec: float = 1.0,
        jitter_m: float = 3.0,
        random_seed: Optional[int] = None
    ):
        self.bot_id = bot_id
        self.route = route
        self.websocket_client = websocket_client
        self.speed_mps = speed_mps
        self.tick_interval_sec = tick_interval_sec
        self.jitter_m = jitter_m
        self.random_seed = random_seed
        
        if random_seed:
            random.seed(random_seed + bot_id)
        
        self.current_waypoint_index = 0
        self.current_position = route['waypoints'][0].copy()
        self.stats = {
            'hexes_visited': set(),
            'claims': [],
            'loops': [],
            'distance_traveled_m': 0.0,
            'start_time': None,
            'end_time': None
        }
    
    async def run(self, duration_limit_sec: Optional[int] = None, loop_count: int = 1):
        """Run bot simulation"""
        self.stats['start_time'] = datetime.utcnow()
        start_time = datetime.utcnow()
        
        for loop in range(loop_count):
            waypoints = self.route['waypoints']
            
            for i in range(len(waypoints) - 1):
                if duration_limit_sec:
                    elapsed = (datetime.utcnow() - start_time).total_seconds()
                    if elapsed >= duration_limit_sec:
                        break
                
                await self.move_to_waypoint(waypoints[i], waypoints[i + 1])
        
        self.stats['end_time'] = datetime.utcnow()
    
    async def move_to_waypoint(self, start: Dict, end: Dict):
        """Move from start to end waypoint"""
        def haversine_distance(lat1, lng1, lat2, lng2):
            R = 6371000
            dlat = radians(lat2 - lat1)
            dlng = radians(lng2 - lng1)
            a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
            c = 2 * asin(sqrt(a))
            return R * c
        
        def bearing(lat1, lng1, lat2, lng2):
            dlat = radians(lat2 - lat1)
            dlng = radians(lng2 - lng1)
            y = sin(dlng) * cos(radians(lat2))
            x = cos(radians(lat1)) * sin(radians(lat2)) - sin(radians(lat1)) * cos(radians(lat2)) * cos(dlng)
            return atan2(y, x)
        
        total_distance = haversine_distance(start['lat'], start['lng'], end['lat'], end['lng'])
        distance_per_tick = self.speed_mps * self.tick_interval_sec
        
        current_lat, current_lng = start['lat'], start['lng']
        brng = bearing(start['lat'], start['lng'], end['lat'], end['lng'])
        
        distance_remaining = total_distance
        
        while distance_remaining > distance_per_tick:
            # Move one tick
            R = 6371000
            d = distance_per_tick
            
            lat1 = radians(current_lat)
            lng1 = radians(current_lng)
            
            lat2 = asin(sin(lat1) * cos(d/R) + cos(lat1) * sin(d/R) * cos(brng))
            lng2 = lng1 + atan2(sin(brng) * sin(d/R) * cos(lat1), cos(d/R) - sin(lat1) * sin(lat2))
            
            current_lat = degrees(lat2)
            current_lng = degrees(lng2)
            
            # Add GPS jitter
            jitter_lat = random.uniform(-self.jitter_m / 111000, self.jitter_m / 111000)
            jitter_lng = random.uniform(-self.jitter_m / (111000 * cos(radians(current_lat))), 
                                       self.jitter_m / (111000 * cos(radians(current_lat))))
            
            current_lat += jitter_lat
            current_lng += jitter_lng
            
            # Send location update
            await self.websocket_client.send_location(
                current_lat, current_lng,
                accuracy=self.jitter_m,
                speed=self.speed_mps
            )
            
            # Update stats
            self.stats['distance_traveled_m'] += distance_per_tick
            self.current_position = {'lat': current_lat, 'lng': current_lng}
            
            # Wait for next tick
            await asyncio.sleep(self.tick_interval_sec)
            
            distance_remaining -= distance_per_tick
        
        # Final position
        self.current_position = end.copy()

