"""
WebSocket consumers
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.sessions.models import Session, Participant, HexOwnership, EventLog, Team
from apps.hexmap.h3_utils import latlng_to_h3
from apps.hexmap.claim_validator import ClaimValidator
from apps.hexmap.loop_detector import LoopDetector


class SessionConsumer(AsyncWebsocketConsumer):
    """Session WebSocket consumer"""
    
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.group_name = f'session_{self.session_id}'
        self.user = self.scope['user']
        
        # Verify session exists and user is participant
        session = await self.get_session()
        if not session:
            await self.close()
            return
        
        participant = await self.get_participant()
        if not participant:
            await self.close()
            return
        
        self.participant_id = str(participant.id)
        self.claim_validator = ClaimValidator(self.participant_id)
        
        # Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        
        # Send join confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'session_id': self.session_id,
            'participant_id': self.participant_id
        }))
    
    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
    
    async def receive(self, text_data):
        """Receive message from WebSocket"""
        try:
            data = json.loads(text_data)
            event_type = data.get('type')
            
            if event_type == 'loc':
                await self.handle_location_update(data)
            elif event_type == 'join_session':
                await self.handle_join(data)
            elif event_type == 'leave_session':
                await self.handle_leave(data)
        
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    async def handle_location_update(self, data):
        """Handle location update"""
        lat = data.get('lat')
        lng = data.get('lng')
        accuracy = data.get('accuracy', 0)
        speed = data.get('speed', 0)
        timestamp = timezone.now()
        
        if not lat or not lng:
            return
        
        # Get session resolution
        session = await self.get_session()
        resolution = session.h3_resolution
        
        # Convert to H3
        h3_id = latlng_to_h3(lat, lng, resolution)
        
        # Update participant location
        await self.update_participant_location(lat, lng, h3_id, timestamp)
        
        # Validate claim
        claimed_h3_id = await self.validate_claim(lat, lng, h3_id, timestamp)
        
        if claimed_h3_id:
            # Process claim
            await self.process_claim(claimed_h3_id)
    
    async def validate_claim(self, lat, lng, h3_id, timestamp):
        """Validate hex claim"""
        # Get participant
        participant = await self.get_participant()
        if not participant:
            return None
        
        # Add sample to validator
        self.claim_validator.add_location_sample(lat, lng, h3_id, timestamp)
        
        # Check if claim is valid
        claimed_h3_id = self.claim_validator.check_claim()
        return claimed_h3_id
    
    async def process_claim(self, h3_id):
        """Process hex claim"""
        participant = await self.get_participant()
        session = await self.get_session()
        
        if not participant or not participant.team:
            return
        
        # Check if already owned
        existing = await database_sync_to_async(HexOwnership.objects.filter(
            session=session,
            h3_id=h3_id
        ).first)()
        
        if existing:
            # Revisit - update visit count
            existing.visit_count += 1
            await database_sync_to_async(existing.save)()
            efficiency = await self.calculate_efficiency(existing.visit_count)
        else:
            # New claim
            existing = await database_sync_to_async(HexOwnership.objects.create)(
                session=session,
                h3_id=h3_id,
                team=participant.team,
                claimed_by=participant,
                visit_count=1
            )
            efficiency = 1.0
        
        # Update team score
        await self.update_team_score(participant.team)
        
        # Log event
        await database_sync_to_async(EventLog.objects.create)(
            session=session,
            event_type='claim',
            participant=participant,
            team=participant.team,
            data={'h3_id': h3_id, 'visit_count': existing.visit_count, 'efficiency': efficiency}
        )
        
        # Broadcast claim
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'claim_hex',
                'participant_id': str(participant.id),
                'team_id': str(participant.team.id),
                'h3_id': h3_id,
                'visit_count': existing.visit_count,
                'efficiency': efficiency,
                'timestamp': timezone.now().isoformat()
            }
        )
        
        # Check for loops
        await self.check_loops(participant.team)
    
    async def check_loops(self, team):
        """Check for completed loops"""
        session = await self.get_session()
        detector = LoopDetector(str(session.id))
        loop_result = await database_sync_to_async(detector.detect_loop)(str(team.id))
        
        if loop_result:
            # Process loop interior
            await self.process_loop(team, loop_result)
    
    async def process_loop(self, team, loop_result):
        """Process completed loop"""
        session = await self.get_session()
        loop_h3_ids = loop_result['loop_h3_ids']
        interior_h3_ids = loop_result['interior_h3_ids']
        
        # Claim interior hexes
        for h3_id in interior_h3_ids:
            await database_sync_to_async(HexOwnership.objects.update_or_create)(
                session=session,
                h3_id=h3_id,
                defaults={
                    'team': team,
                    'visit_count': 1
                }
            )
        
        # Update team score
        await self.update_team_score(team)
        
        # Log event
        await database_sync_to_async(EventLog.objects.create)(
            session=session,
            event_type='loop',
            team=team,
            data={
                'loop_h3_ids': loop_h3_ids,
                'interior_h3_ids': interior_h3_ids,
                'interior_count': len(interior_h3_ids)
            }
        )
        
        # Broadcast loop
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'loop_complete',
                'team_id': str(team.id),
                'loop_h3_ids': loop_h3_ids,
                'interior_h3_ids': interior_h3_ids,
                'interior_count': len(interior_h3_ids),
                'timestamp': timezone.now().isoformat()
            }
        )
    
    async def update_team_score(self, team):
        """Update team score"""
        session = await self.get_session()
        count = await database_sync_to_async(HexOwnership.objects.filter(
            session=session,
            team=team
        ).count)()
        
        team.score = count
        await database_sync_to_async(team.save)()
        
        # Broadcast score update
        await self.broadcast_score_update()
    
    async def broadcast_score_update(self):
        """Broadcast score update"""
        session = await self.get_session()
        teams = await database_sync_to_async(list)(session.teams.all())
        
        scores = []
        for team in teams:
            scores.append({
                'team_id': str(team.id),
                'team_name': team.name,
                'hex_count': team.score,
            })
        
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'score_update',
                'scores': scores,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    async def handle_join(self, data):
        """Handle join event"""
        # Already handled in connect
        pass
    
    async def handle_leave(self, data):
        """Handle leave event"""
        participant = await self.get_participant()
        if participant:
            participant.status = 'left'
            await database_sync_to_async(participant.save)()
    
    # WebSocket event handlers
    async def claim_hex(self, event):
        """Send claim event to WebSocket"""
        await self.send(text_data=json.dumps(event))
    
    async def loop_complete(self, event):
        """Send loop event to WebSocket"""
        await self.send(text_data=json.dumps(event))
    
    async def score_update(self, event):
        """Send score update to WebSocket"""
        await self.send(text_data=json.dumps(event))
    
    async def match_end(self, event):
        """Send match end event to WebSocket"""
        await self.send(text_data=json.dumps(event))
    
    # Database helpers
    @database_sync_to_async
    def get_session(self):
        try:
            return Session.objects.get(id=self.session_id)
        except Session.DoesNotExist:
            return None
    
    @database_sync_to_async
    def get_participant(self):
        try:
            session = Session.objects.get(id=self.session_id)
            return Participant.objects.get(session=session, user=self.user)
        except (Session.DoesNotExist, Participant.DoesNotExist):
            return None
    
    @database_sync_to_async
    def update_participant_location(self, lat, lng, h3_id, timestamp):
        participant = Participant.objects.get(id=self.participant_id)
        participant.last_lat = lat
        participant.last_lng = lng
        participant.last_h3_id = h3_id
        participant.last_location_at = timestamp
        participant.status = 'active'
        participant.save()
    
    @database_sync_to_async
    def calculate_efficiency(self, visit_count):
        from django.conf import settings
        efficiency_map = settings.GAME_REVISIT_EFFICIENCY
        return efficiency_map.get(visit_count, efficiency_map.get(3, 0.6))

