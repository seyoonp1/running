"""
Room views - MVP 버전
"""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from datetime import timedelta
import datetime

from .models import GameArea, Room, Participant, RunningRecord
from .serializers import (
    GameAreaSerializer, GameAreaListSerializer,
    RoomListSerializer, RoomDetailSerializer, RoomCreateSerializer,
    ParticipantSerializer, RunningRecordSerializer,
    RunningRecordStartSerializer, RunningRecordStopSerializer,
    RunningStatsSerializer
)
from apps.accounts.models import User, Friendship, Mailbox


# ==================== 게임 구역 API ====================

class GameAreaListView(generics.ListAPIView):
    """
    5. 게임 구역 목록 조회
    GET /api/game-areas/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = GameAreaListSerializer
    
    def get_queryset(self):
        queryset = GameArea.objects.filter(is_active=True)
        city = self.request.query_params.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)
        return queryset


class GameAreaDetailView(generics.RetrieveAPIView):
    """게임 구역 상세 조회"""
    permission_classes = [IsAuthenticated]
    queryset = GameArea.objects.filter(is_active=True)
    serializer_class = GameAreaSerializer
    lookup_field = 'id'


# ==================== 방 API ====================

class RoomListCreateView(generics.ListCreateAPIView):
    """
    6. 방 생성 / 7. 방 목록 조회
    POST /api/rooms/
    GET /api/rooms/
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Room.objects.all()
        status_filter = self.request.query_params.get('status')
        q = self.request.query_params.get('q')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        else:
            queryset = queryset.filter(status__in=['ready', 'active'])
        
        if q:
            queryset = queryset.filter(name__icontains=q)
        
        return queryset
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RoomCreateSerializer
        return RoomListSerializer
    
    def perform_create(self, serializer):
        room = serializer.save(creator=self.request.user)
        
        # 방장을 참가자로 추가 (A팀, is_host=True)
        Participant.objects.create(
            room=room,
            user=self.request.user,
            team='A',
            is_host=True
        )
        
        return room
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = self.perform_create(serializer)
        
        # 상세 응답 반환
        response_serializer = RoomDetailSerializer(room)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class RoomDetailView(generics.RetrieveAPIView):
    """
    8. 방 상세 조회
    GET /api/rooms/{id}/
    """
    permission_classes = [IsAuthenticated]
    queryset = Room.objects.all()
    serializer_class = RoomDetailSerializer
    lookup_field = 'id'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_current_room(request):
    """
    내가 현재 참가 중인 방 조회
    GET /api/rooms/my/
    """
    # 현재 사용자가 참가 중인 방 찾기
    # active > ready > finished 순으로 우선순위
    from django.db.models import Case, When, IntegerField
    
    participants = Participant.objects.filter(
        user=request.user
    ).select_related('room', 'room__game_area').annotate(
        status_priority=Case(
            When(room__status='active', then=1),
            When(room__status='ready', then=2),
            When(room__status='finished', then=3),
            default=4,
            output_field=IntegerField()
        )
    ).order_by(
        'status_priority',  # 1(active) > 2(ready) > 3(finished)
        '-room__created_at'  # 같은 상태면 최신순
    )
    
    participant = participants.first()
    
    if not participant:
        return Response(None, status=status.HTTP_200_OK)
    
    # 방 상세 정보
    room = participant.room
    serializer = RoomDetailSerializer(room, context={'request': request})
    
    # 내 참가자 정보 추가
    data = serializer.data
    data['my_participant'] = ParticipantSerializer(participant).data
    
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request):
    """
    9. 방 참가 (초대 코드)
    POST /api/rooms/join/
    """
    invite_code = request.data.get('invite_code')
    team = request.data.get('team')  # 'A' 또는 'B', 선택사항
    
    if not invite_code:
        return Response({'error': 'INVALID_INPUT', 'message': '초대 코드가 필요합니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        room = Room.objects.get(invite_code=invite_code.upper())
    except Room.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 방 상태 확인
    if room.status != 'ready':
        return Response({'error': 'ROOM_NOT_READY', 'message': '방이 준비 상태가 아닙니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 이미 참가 중인지 확인
    if Participant.objects.filter(room=room, user=request.user).exists():
        return Response({'error': 'ALREADY_JOINED', 'message': '이미 참가 중입니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # 방 정원 확인
    if room.current_participants_count >= room.total_participants:
        return Response({'error': 'ROOM_FULL', 'message': '방 정원이 초과되었습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 팀 결정
    team_a_count = room.team_a_count
    team_b_count = room.team_b_count
    max_per_team = room.total_participants // 2
    
    if team:
        team = team.upper()
        if team not in ['A', 'B']:
            return Response({'error': 'INVALID_INPUT', 'message': '팀은 A 또는 B여야 합니다.'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        if team == 'A' and team_a_count >= max_per_team:
            return Response({'error': 'TEAM_FULL', 'message': 'A팀 정원이 초과되었습니다.'}, 
                           status=status.HTTP_403_FORBIDDEN)
        if team == 'B' and team_b_count >= max_per_team:
            return Response({'error': 'TEAM_FULL', 'message': 'B팀 정원이 초과되었습니다.'}, 
                           status=status.HTTP_403_FORBIDDEN)
    else:
        # 자동 배정: 인원이 적은 팀으로
        if team_a_count <= team_b_count and team_a_count < max_per_team:
            team = 'A'
        elif team_b_count < max_per_team:
            team = 'B'
        else:
            return Response({'error': 'ROOM_FULL', 'message': '방 정원이 초과되었습니다.'}, 
                           status=status.HTTP_403_FORBIDDEN)
    
    # 참가자 생성
    participant = Participant.objects.create(
        room=room,
        user=request.user,
        team=team,
        is_host=False
    )
    
    return Response({
        'message': '방에 참가했습니다.',
        'room': RoomDetailSerializer(room).data,
        'participant': ParticipantSerializer(participant).data
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_room(request, id):
    """
    10. 방 나가기
    POST /api/rooms/{id}/leave/
    """
    try:
        room = Room.objects.get(id=id)
    except Room.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 방 상태 확인
    if room.status != 'ready':
        return Response({'error': 'ROOM_NOT_READY', 'message': '방이 준비 상태일 때만 나갈 수 있습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 참가자 확인
    try:
        participant = Participant.objects.get(room=room, user=request.user)
    except Participant.DoesNotExist:
        return Response({'error': 'NOT_MEMBER', 'message': '방의 멤버가 아닙니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    was_host = participant.is_host
    participant.delete()
    
    # 남은 참가자 확인
    remaining = room.participants.count()
    
    if remaining == 0:
        # 방 삭제
        room.delete()
        return Response({'message': '방에서 나갔습니다. 방이 삭제되었습니다.'})
    
    # 방장이 나간 경우 다른 사람에게 방장 위임
    if was_host:
        new_host = room.participants.order_by('joined_at').first()
        if new_host:
            new_host.is_host = True
            new_host.save(update_fields=['is_host'])
    
    return Response({'message': '방에서 나갔습니다.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_team(request, id):
    """
    11. 팀 변경
    POST /api/rooms/{id}/change-team/
    """
    try:
        room = Room.objects.get(id=id)
    except Room.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 방 상태 확인
    if room.status != 'ready':
        return Response({'error': 'ROOM_NOT_READY', 'message': '방이 준비 상태일 때만 팀을 변경할 수 있습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 참가자 확인
    try:
        participant = Participant.objects.get(room=room, user=request.user)
    except Participant.DoesNotExist:
        return Response({'error': 'NOT_MEMBER', 'message': '방의 멤버가 아닙니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    new_team = request.data.get('team', '').upper()
    if new_team not in ['A', 'B']:
        return Response({'error': 'INVALID_INPUT', 'message': '팀은 A 또는 B여야 합니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    if participant.team == new_team:
        return Response({'error': 'SAME_TEAM', 'message': '이미 해당 팀에 속해 있습니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # 팀 정원 확인
    max_per_team = room.total_participants // 2
    if new_team == 'A' and room.team_a_count >= max_per_team:
        return Response({'error': 'TEAM_FULL', 'message': 'A팀 정원이 초과되었습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    if new_team == 'B' and room.team_b_count >= max_per_team:
        return Response({'error': 'TEAM_FULL', 'message': 'B팀 정원이 초과되었습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    participant.team = new_team
    participant.save(update_fields=['team'])
    
    return Response({
        'message': '팀을 변경했습니다.',
        'participant': ParticipantSerializer(participant).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_room(request, id):
    """
    12. 방 시작 (방장 전용)
    POST /api/rooms/{id}/start/
    """
    try:
        room = Room.objects.get(id=id)
    except Room.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 방장 확인
    try:
        participant = Participant.objects.get(room=room, user=request.user)
        if not participant.is_host:
            return Response({'error': 'PERMISSION_DENIED', 'message': '방장만 시작할 수 있습니다.'}, 
                           status=status.HTTP_403_FORBIDDEN)
    except Participant.DoesNotExist:
        return Response({'error': 'NOT_MEMBER', 'message': '방의 멤버가 아닙니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 방 상태 확인
    if room.status != 'ready':
        return Response({'error': 'ROOM_NOT_READY', 'message': '방이 준비 상태가 아닙니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 인원 확인
    if room.current_participants_count < room.total_participants:
        return Response({'error': 'NOT_FULL', 'message': '모든 인원이 참가해야 시작할 수 있습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 시작 날짜 확인
    today = timezone.now().date()
    if today < room.start_date:
        return Response({'error': 'NOT_START_DATE', 'message': f'시작 날짜({room.start_date}) 이후에 시작할 수 있습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 방 상태 변경
    room.status = 'active'
    room.save(update_fields=['status'])
    
    return Response({
        'message': '게임이 시작되었습니다.',
        'room': {
            'id': str(room.id),
            'status': room.status,
            'start_date': room.start_date
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_to_room(request, id):
    """
    13. 친구 초대 (방 내에서)
    POST /api/rooms/{id}/invite/
    """
    try:
        room = Room.objects.get(id=id)
    except Room.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 참가자 확인
    if not Participant.objects.filter(room=room, user=request.user).exists():
        return Response({'error': 'NOT_MEMBER', 'message': '방의 멤버만 초대할 수 있습니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'INVALID_INPUT', 'message': 'user_id가 필요합니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '사용자를 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 자기 자신 초대 방지
    if target_user == request.user:
        return Response({'error': 'INVALID_INPUT', 'message': '자기 자신을 초대할 수 없습니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # 이미 참가 중인지 확인
    if Participant.objects.filter(room=room, user=target_user).exists():
        return Response({'error': 'ALREADY_JOINED', 'message': '이미 참가 중인 사용자입니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # 우편함에 초대 메일 생성
    Mailbox.objects.create(
        sender=request.user,
        receiver=target_user,
        room=room,
        mail_type='room_invite',
        status='unread'
    )
    
    return Response({'message': '초대를 보냈습니다.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_status(request, id):
    """
    출석 현황 조회
    GET /api/rooms/{id}/attendance/
    """
    try:
        room = Room.objects.get(id=id)
    except Room.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    # 참가자 확인
    try:
        participant = Participant.objects.get(room=room, user=request.user)
    except Participant.DoesNotExist:
        return Response({'error': 'NOT_MEMBER', 'message': '방의 멤버가 아닙니다.'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # 다음 출석 보상 계산
    current_streak = participant.consecutive_attendance_days
    next_reward = min(current_streak + 1, 7) if current_streak >= 1 else 2
    
    # 오늘 출석 여부
    today = timezone.now().date()
    attended_today = participant.last_attendance_date == today
    
    return Response({
        'consecutive_days': current_streak,
        'last_attendance_date': participant.last_attendance_date,
        'attended_today': attended_today,
        'current_paintball_count': participant.paintball_count,
        'next_reward': next_reward if current_streak >= 1 else 2,
        'max_reward': 7,
        'reward_info': {
            'description': '연속 출석 보상',
            'rewards': [
                {'days': 2, 'paintballs': 2},
                {'days': 3, 'paintballs': 3},
                {'days': 4, 'paintballs': 4},
                {'days': 5, 'paintballs': 5},
                {'days': 6, 'paintballs': 6},
                {'days': 7, 'paintballs': 7, 'note': '최대'},
            ],
            'how_to_attend': '기록 중일 때 다른 헥사곤으로 이동하면 출석 체크됩니다.'
        }
    })


# ==================== 러닝 기록 API ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_record(request):
    """
    14. 기록 시작
    POST /api/records/start/
    """
    serializer = RunningRecordStartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    room_id = serializer.validated_data.get('room_id')
    room = None
    participant = None
    
    if room_id:
        try:
            room = Room.objects.get(id=room_id)
            participant = Participant.objects.get(room=room, user=request.user)
            
            # 이미 기록 중인지 확인
            if participant.is_recording:
                return Response({'error': 'ALREADY_RECORDING', 'message': '이미 기록 중입니다.'}, 
                               status=status.HTTP_400_BAD_REQUEST)
            
            # 기록 상태 변경
            participant.is_recording = True
            participant.save(update_fields=['is_recording'])
            
        except Room.DoesNotExist:
            return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                           status=status.HTTP_404_NOT_FOUND)
        except Participant.DoesNotExist:
            return Response({'error': 'NOT_MEMBER', 'message': '방의 멤버가 아닙니다.'}, 
                           status=status.HTTP_403_FORBIDDEN)
    
    # 러닝 기록 생성
    record = RunningRecord.objects.create(
        user=request.user,
        room=room,
        participant=participant,
        started_at=timezone.now()
    )
    
    return Response({
        'id': str(record.id),
        'started_at': record.started_at,
        'room_id': str(room.id) if room else None
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_record(request, id):
    """
    15. 기록 종료
    POST /api/records/{id}/stop/
    """
    try:
        record = RunningRecord.objects.get(id=id, user=request.user)
    except RunningRecord.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '기록을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    if record.ended_at:
        return Response({'error': 'ALREADY_STOPPED', 'message': '이미 종료된 기록입니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    serializer = RunningRecordStopSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # 기록 업데이트
    record.duration_seconds = serializer.validated_data['duration_seconds']
    record.distance_meters = serializer.validated_data['distance_meters']
    record.ended_at = timezone.now()
    record.calculate_pace()
    record.save()
    
    # 참가자 기록 상태 변경
    if record.participant:
        record.participant.is_recording = False
        record.participant.save(update_fields=['is_recording'])
    
    return Response(RunningRecordSerializer(record).data)


class RunningRecordListView(generics.ListAPIView):
    """
    16. 내 기록 목록
    GET /api/records/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = RunningRecordSerializer
    
    def get_queryset(self):
        queryset = RunningRecord.objects.filter(
            user=self.request.user,
            ended_at__isnull=False  # 완료된 기록만
        )
        
        # 필터링
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        week = self.request.query_params.get('week')
        
        if year:
            queryset = queryset.filter(started_at__year=int(year))
        if month:
            queryset = queryset.filter(started_at__month=int(month))
        if week:
            # ISO 주차 기준
            queryset = queryset.filter(started_at__week=int(week))
        
        return queryset


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def record_stats(request):
    """
    17. 기록 통계
    GET /api/records/stats/
    """
    period = request.query_params.get('period', 'all')  # year, month, week, all
    
    queryset = RunningRecord.objects.filter(
        user=request.user,
        ended_at__isnull=False
    )
    
    today = timezone.now().date()
    
    if period == 'year':
        start_of_year = today.replace(month=1, day=1)
        queryset = queryset.filter(started_at__date__gte=start_of_year)
    elif period == 'month':
        start_of_month = today.replace(day=1)
        queryset = queryset.filter(started_at__date__gte=start_of_month)
    elif period == 'week':
        start_of_week = today - timedelta(days=today.weekday())
        queryset = queryset.filter(started_at__date__gte=start_of_week)
    
    # 통계 계산
    stats = queryset.aggregate(
        total_distance=Sum('distance_meters'),
        total_duration=Sum('duration_seconds'),
        total_runs=Count('id')
    )
    
    total_distance = stats['total_distance'] or 0
    total_duration = stats['total_duration'] or 0
    total_runs = stats['total_runs'] or 0
    
    # 평균 페이스 계산
    avg_pace = None
    if total_distance > 0:
        avg_pace = (total_duration / total_distance) * 1000
    
    return Response({
        'period': period,
        'total_distance_meters': total_distance,
        'total_duration_seconds': total_duration,
        'total_runs': total_runs,
        'avg_pace_seconds_per_km': avg_pace
    })
