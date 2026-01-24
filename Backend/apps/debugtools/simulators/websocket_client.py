"""
WebSocket client for simulation
"""
import asyncio
import json
import websockets
from typing import Callable, Optional
from datetime import datetime


class SimulatorWebSocketClient:
    """WebSocket client for bot simulation"""
    
    def __init__(self, url: str, session_id: str, participant_id: str, access_token: str):
        self.url = url
        self.session_id = session_id
        self.participant_id = participant_id
        self.access_token = access_token
        self.websocket = None
        self.received_events = []
    
    async def connect(self):
        """Connect to WebSocket"""
        headers = {
            'Authorization': f'Bearer {self.access_token}'
        }
        ws_url = f"{self.url}/ws/session/{self.session_id}/"
        self.websocket = await websockets.connect(ws_url, extra_headers=headers)
        
        # Wait for connection confirmation
        message = await self.websocket.recv()
        data = json.loads(message)
        if data.get('type') == 'connection_established':
            return True
        return False
    
    async def disconnect(self):
        """Disconnect from WebSocket"""
        if self.websocket:
            await self.websocket.close()
    
    async def send_location(self, lat: float, lng: float, accuracy: float = 10.0, speed: float = 2.8):
        """Send location update"""
        message = {
            'type': 'loc',
            'session_id': self.session_id,
            'participant_id': self.participant_id,
            'lat': lat,
            'lng': lng,
            'accuracy': accuracy,
            'speed': speed,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
        await self.websocket.send(json.dumps(message))
    
    async def listen(self, callback: Optional[Callable] = None):
        """Listen for messages"""
        try:
            while True:
                message = await self.websocket.recv()
                data = json.loads(message)
                self.received_events.append(data)
                
                if callback:
                    await callback(data)
        except websockets.exceptions.ConnectionClosed:
            pass
    
    def get_events_by_type(self, event_type: str) -> list:
        """Get events by type"""
        return [e for e in self.received_events if e.get('type') == event_type]

