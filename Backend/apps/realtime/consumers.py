"""
WebSocket consumers - MVP 버전
Room과 Participant 모델 사용 (Session 모델 제거됨)
"""
import json
import math
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.rooms.models import Room, Participant, RunningRecord
from apps.hexmap.h3_utils import latlng_to_h3
from apps.hexmap.claim_validator import ClaimValidator
from apps.hexmap.loop_detector import LoopDetector


def haversine_distance(lat1, lng1, lat2, lng2):
    """
    두 좌표 간 거리 계산 (Haversine 공식)
    반환값: 미터 단위
    """
    R = 6371000  # 지구 반지름 (미터)
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    
    a = (math.sin(delta_phi / 2) ** 2 + 
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c



class RoomConsumer(AsyncWebsocketConsumer):
    """
    Room WebSocket consumer
    실시간 위치 업데이트, 점령 처리, 페인트볼 사용 등 처리
    """
    
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.group_name = f'room_{self.room_id}'
        self.user = self.scope['user']
        
        # 방 및 참가자 확인
        room = await self.get_room()
        if not room:
            await self.close()
            return
        
        participant = await self.get_participant()
        if not participant:
            await self.close()
            return
        
        self.participant_id = str(participant.id)
        self.claim_validator = ClaimValidator(self.participant_id)
        
        # 거리 계산용 변수 초기화
        self.last_position = None  # 마지막 위치 {'lat': float, 'lng': float}
        self.total_distance = 0.0  # 누적 거리 (미터)
        self.recording_start_time = None  # 기록 시작 시간
        
        # 그룹 참가
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        
        # 연결 확인 메시지
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'room_id': self.room_id,
            'participant_id': self.participant_id
        }))
    
    async def disconnect(self, close_code):
        # 그룹에서 나가기
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
    
    async def receive(self, text_data):
        """WebSocket 메시지 수신"""
        try:
            data = json.loads(text_data)
            event_type = data.get('type')
            
            if event_type == 'loc':
                # 위치 업데이트
                await self.handle_location_update(data)
            elif event_type == 'paintball':
                # 페인트볼 사용
                await self.handle_paintball(data)
            elif event_type == 'start_recording':
                # 기록 시작
                await self.handle_start_recording()
            elif event_type == 'stop_recording':
                # 기록 종료
                await self.handle_stop_recording(data)
        
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    async def handle_location_update(self, data):
        """위치 업데이트 처리"""
        lat = data.get('lat')
        lng = data.get('lng')
        accuracy = data.get('accuracy', 0)
        speed = data.get('speed', 0)
        timestamp = timezone.now()
        
        if lat is None or lng is None:
            return
        
        # 방 정보 가져오기
        room = await self.get_room()
        if not room or room.status != 'active':
            return
        
        # 참가자 가져오기
        participant = await self.get_participant()
        if not participant:
            return
        
        # H3 ID 계산
        resolution = room.h3_resolution
        h3_id = latlng_to_h3(lat, lng, resolution)
        
        # 위치 업데이트
        await self.update_participant_location(lat, lng, h3_id, timestamp)
        
        # 위치 브로드캐스트
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'location_update',
                'participant_id': self.participant_id,
                'lat': lat,
                'lng': lng,
                'h3_id': h3_id,
                'timestamp': timestamp.isoformat()
            }
        )
        
        # 기록 중인 경우에만 점령 처리 및 거리 계산
        if participant.is_recording:
            # 거리 계산 (GPS 위치 기반)
            if self.last_position is not None:
                distance = haversine_distance(
                    self.last_position['lat'], self.last_position['lng'],
                    lat, lng
                )
                
                # 이상값 필터링 (순간 이동 방지)
                # 속도가 시속 50km 이상이면 무시 (약 14m/s)
                MAX_SPEED_MPS = 14.0
                time_diff = 1.0  # 기본 1초 (실제로는 이전 timestamp와 비교 필요)
                if distance / time_diff <= MAX_SPEED_MPS:
                    self.total_distance += distance
            
            self.last_position = {'lat': lat, 'lng': lng}
            
            # 점령 로직 처리
            await self.process_claim_logic(lat, lng, h3_id, timestamp, participant, room)
    
    async def process_claim_logic(self, lat, lng, h3_id, timestamp, participant, room):
        """점령 로직 처리"""
        # 클레임 검증기에 샘플 추가
        self.claim_validator.add_location_sample(lat, lng, h3_id, timestamp)
        
        # 클레임 검증
        claimed_h3_id = self.claim_validator.check_claim()
        
        if claimed_h3_id:
            await self.process_claim(claimed_h3_id, participant, room)
    
    async def process_claim(self, h3_id, participant, room):
        """점령 처리"""
        team = participant.team
        user_id = str(participant.user_id)
        
        # 현재 소유 상태 확인
        current_ownerships = room.current_hex_ownerships or {}
        existing = current_ownerships.get(h3_id)
        
        gauge_to_add = 0
        claimed = False
        
        if existing:
            if existing.get('team') == team:
                # 같은 팀의 땅 → +60 게이지
                gauge_to_add = 60
            else:
                # 상대 팀 땅 점령
                current_ownerships[h3_id] = {
                    'team': team,
                    'user_id': user_id,
                    'claimed_at': timezone.now().isoformat()
                }
                claimed = True
        else:
            # 빈 땅 점령
            current_ownerships[h3_id] = {
                'team': team,
                'user_id': user_id,
                'claimed_at': timezone.now().isoformat()
            }
            claimed = True
        
        # 게이지 추가
        if gauge_to_add > 0:
            await self.add_gauge(participant, gauge_to_add)
        
        # 점령 저장
        if claimed:
            await self.save_hex_ownerships(room, current_ownerships)
            
            # 출석 체크 (다른 hex로 이동)
            await self.check_attendance(participant, h3_id)
            
            # 점령 브로드캐스트
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'hex_claimed',
                    'participant_id': self.participant_id,
                    'team': team,
                    'h3_id': h3_id,
                    'timestamp': timezone.now().isoformat()
                }
            )
            
            # 루프 감지 및 내부 hex 자동 점령 (새로 점령한 hex가 포함된 루프만 찾기)
            await self.check_and_claim_loop(team, room, participant, h3_id)
            
            # 점수 업데이트 브로드캐스트
            await self.broadcast_score_update(room)
    
    async def handle_paintball(self, data):
        """페인트볼 사용 처리"""
        paintball_type = data.get('paintball_type', 'normal')  # normal 또는 super
        target_h3_id = data.get('target_h3_id')
        
        if not target_h3_id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'target_h3_id가 필요합니다.'
            }))
            return
        
        participant = await self.get_participant()
        room = await self.get_room()
        
        if not participant or not room or room.status != 'active':
            return
        
        # 페인트볼 사용
        if paintball_type == 'super':
            success = await self.use_super_paintball(participant)
        else:
            success = await self.use_paintball(participant)
        
        if not success:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '페인트볼이 부족합니다.'
            }))
            return
        
        # 타겟 hex 점령
        team = participant.team
        user_id = str(participant.user_id)
        
        current_ownerships = room.current_hex_ownerships or {}
        current_ownerships[target_h3_id] = {
            'team': team,
            'user_id': user_id,
            'claimed_at': timezone.now().isoformat()
        }
        
        await self.save_hex_ownerships(room, current_ownerships)
        
        # 브로드캐스트
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'paintball_used',
                'participant_id': self.participant_id,
                'team': team,
                'paintball_type': paintball_type,
                'target_h3_id': target_h3_id,
                'timestamp': timezone.now().isoformat()
            }
        )
        
        # 루프 감지 및 내부 hex 자동 점령 (페인트볼로 점령한 hex가 포함된 루프만 찾기)
        await self.check_and_claim_loop(team, room, participant, target_h3_id)
        
        await self.broadcast_score_update(room)
    
    async def handle_start_recording(self):
        """기록 시작 처리"""
        participant = await self.get_participant()
        room = await self.get_room()
        
        if not participant or not room:
            return
        
        if participant.is_recording:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '이미 기록 중입니다.'
            }))
            return
        
        # 거리 계산 변수 초기화
        self.last_position = None
        self.total_distance = 0.0
        self.recording_start_time = timezone.now()
        
        # 기록 시작
        await database_sync_to_async(lambda: (
            setattr(participant, 'is_recording', True),
            participant.save(update_fields=['is_recording'])
        )[-1])()
        
        # 러닝 기록 생성
        record = await database_sync_to_async(RunningRecord.objects.create)(
            user=participant.user,
            room=room,
            participant=participant,
            started_at=self.recording_start_time
        )
        
        await self.send(text_data=json.dumps({
            'type': 'recording_started',
            'record_id': str(record.id),
            'started_at': record.started_at.isoformat()
        }))
    
    async def handle_stop_recording(self, data):
        """기록 종료 처리"""
        participant = await self.get_participant()
        
        if not participant or not participant.is_recording:
            return
        
        # 백엔드에서 계산한 값 사용
        ended_at = timezone.now()
        
        # 시간 계산 (백엔드에서 계산)
        if self.recording_start_time:
            duration_seconds = int((ended_at - self.recording_start_time).total_seconds())
        else:
            # recording_start_time이 없으면 0 (정상적인 경우 발생하지 않음)
            duration_seconds = 0
        
        # 거리: 백엔드에서 계산한 값 사용
        distance_meters = self.total_distance
        
        # 기록 종료
        await database_sync_to_async(lambda: (
            setattr(participant, 'is_recording', False),
            participant.save(update_fields=['is_recording'])
        )[-1])()
        
        # 마지막 러닝 기록 업데이트
        record = await database_sync_to_async(
            lambda: RunningRecord.objects.filter(
                participant=participant,
                ended_at__isnull=True
            ).order_by('-started_at').first()
        )()
        
        if record:
            record.duration_seconds = duration_seconds
            record.distance_meters = distance_meters
            record.ended_at = ended_at
            record.calculate_pace()
            await database_sync_to_async(record.save)()
            
            await self.send(text_data=json.dumps({
                'type': 'recording_stopped',
                'record_id': str(record.id),
                'duration_seconds': record.duration_seconds,
                'distance_meters': round(record.distance_meters, 2),
                'avg_pace_seconds_per_km': record.avg_pace_seconds_per_km
            }))
        
        # 거리 계산 변수 초기화
        self.last_position = None
        self.total_distance = 0.0
        self.recording_start_time = None
    
    async def broadcast_score_update(self, room):
        """점수 업데이트 브로드캐스트"""
        ownerships = room.current_hex_ownerships or {}
        
        team_a_count = sum(1 for h in ownerships.values() if h.get('team') == 'A')
        team_b_count = sum(1 for h in ownerships.values() if h.get('team') == 'B')
        
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'score_update',
                'team_a_count': team_a_count,
                'team_b_count': team_b_count,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    # Database helper methods
    
    @database_sync_to_async
    def get_room(self):
        try:
            return Room.objects.get(id=self.room_id)
        except Room.DoesNotExist:
            return None
    
    @database_sync_to_async
    def get_participant(self):
        try:
            return Participant.objects.get(room_id=self.room_id, user=self.user)
        except Participant.DoesNotExist:
            return None
    
    @database_sync_to_async
    def update_participant_location(self, lat, lng, h3_id, timestamp):
        try:
            participant = Participant.objects.get(room_id=self.room_id, user=self.user)
            participant.last_lat = lat
            participant.last_lng = lng
            participant.last_h3_id = h3_id
            participant.last_location_at = timestamp
            participant.save(update_fields=['last_lat', 'last_lng', 'last_h3_id', 'last_location_at'])
        except Participant.DoesNotExist:
            pass
    
    @database_sync_to_async
    def add_gauge(self, participant, amount):
        participant.add_gauge(amount)
    
    @database_sync_to_async
    def use_paintball(self, participant):
        return participant.use_paintball()
    
    @database_sync_to_async
    def use_super_paintball(self, participant):
        return participant.use_super_paintball()
    
    @database_sync_to_async
    def save_hex_ownerships(self, room, ownerships):
        room.current_hex_ownerships = ownerships
        room.save(update_fields=['current_hex_ownerships'])
    
    @database_sync_to_async
    def check_attendance(self, participant, new_h3_id):
        """출석 체크 (다른 hex로 이동 시)"""
        today = timezone.now().date()
        
        if participant.last_h3_id and participant.last_h3_id != new_h3_id:
            if participant.last_attendance_date != today:
                # 연속 출석 확인
                if participant.last_attendance_date:
                    days_diff = (today - participant.last_attendance_date).days
                    if days_diff == 1:
                        participant.consecutive_attendance_days += 1
                    else:
                        participant.consecutive_attendance_days = 1
                else:
                    participant.consecutive_attendance_days = 1
                
                # 출석 보상 계산 (2일: +2, 3일: +3, ..., 최대 +7)
                bonus = min(participant.consecutive_attendance_days, 7)
                if bonus >= 2:
                    participant.paintball_count += bonus
                
                participant.last_attendance_date = today
                participant.save(update_fields=[
                    'consecutive_attendance_days', 
                    'last_attendance_date',
                    'paintball_count'
                ])
    
    async def check_and_claim_loop(self, team, room, participant, new_hex_id):
        """루프 감지 및 내부 hex 자동 점령"""
        # 새로 점령한 hex가 포함된 루프만 찾기
        loop_result = await self.detect_loop(team, room, new_hex_id)
        
        if loop_result and loop_result.get('interior_h3_ids'):
            # 내부 hex 자동 점령
            await self.claim_interior_hexes(loop_result, participant, room)
    
    @database_sync_to_async
    def detect_loop(self, team, room, new_hex_id=None):
        """루프 감지 (동기 함수)"""
        detector = LoopDetector(str(room.id))
        current_ownerships = room.current_hex_ownerships or {}
        return detector.detect_loop(team, current_ownerships, new_hex_id)
    
    async def claim_interior_hexes(self, loop_result, participant, room):
        """루프 내부 hex 자동 점령"""
        interior_h3_ids = loop_result.get('interior_h3_ids', [])
        loop_h3_ids = loop_result.get('loop_h3_ids', [])
        
        if not interior_h3_ids:
            return
        
        # 최신 room 객체 가져오기
        room = await self.get_room()
        if not room:
            return
        
        team = participant.team
        user_id = str(participant.user_id)
        
        # 현재 소유 상태 가져오기 (최신 상태)
        current_ownerships = room.current_hex_ownerships or {}
        claimed_count = 0
        
        # 내부 hex들을 자동 점령
        for h3_id in interior_h3_ids:
            # 이미 점령된 hex는 건너뛰기
            if h3_id in current_ownerships:
                continue
            
            current_ownerships[h3_id] = {
                'team': team,
                'user_id': user_id,
                'claimed_at': timezone.now().isoformat(),
                'claimed_by': 'loop'  # 루프로 인한 자동 점령 표시
            }
            claimed_count += 1
        
        if claimed_count > 0:
            # 점령 상태 저장
            await self.save_hex_ownerships(room, current_ownerships)
            
            # 루프 완성 이벤트 브로드캐스트
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'loop_complete',
                    'participant_id': self.participant_id,
                    'team': team,
                    'loop_h3_ids': loop_h3_ids,
                    'interior_h3_ids': interior_h3_ids,
                    'claimed_count': claimed_count,
                    'timestamp': timezone.now().isoformat()
                }
            )
    
    # Event handlers (channel layer callbacks)
    
    async def location_update(self, event):
        """위치 업데이트 브로드캐스트"""
        await self.send(text_data=json.dumps(event))
    
    async def hex_claimed(self, event):
        """점령 브로드캐스트"""
        await self.send(text_data=json.dumps(event))
    
    async def paintball_used(self, event):
        """페인트볼 사용 브로드캐스트"""
        await self.send(text_data=json.dumps(event))
    
    async def score_update(self, event):
        """점수 업데이트 브로드캐스트"""
        await self.send(text_data=json.dumps(event))
    
    async def game_ended(self, event):
        """게임 종료 브로드캐스트"""
        await self.send(text_data=json.dumps(event))
    
    async def loop_complete(self, event):
        """루프 완성 브로드캐스트"""
        await self.send(text_data=json.dumps(event))
