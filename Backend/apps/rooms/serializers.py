"""
Room serializers - MVP 버전
"""
from rest_framework import serializers
from .models import GameArea, Room, Participant, RunningRecord
from apps.accounts.serializers import UserSerializer


class GameAreaListSerializer(serializers.ModelSerializer):
    """게임 구역 목록용 간략 Serializer"""
    class Meta:
        model = GameArea
        fields = ['id', 'name', 'city', 'description', 'bounds', 'h3_resolution', 'is_active']


class ParticipantSerializer(serializers.ModelSerializer):
    """참가자 Serializer"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Participant
        fields = [
            'id', 'user', 'team', 'is_host', 'is_recording',
            'paintball_count', 'super_paintball_count', 'paintball_gauge',
            'consecutive_attendance_days', 'joined_at'
        ]
        read_only_fields = ['id', 'user', 'joined_at']


class RoomListSerializer(serializers.ModelSerializer):
    """방 목록용 간략 Serializer"""
    current_participants = serializers.SerializerMethodField()
    game_area_name = serializers.CharField(source='game_area.name', read_only=True)
    
    class Meta:
        model = Room
        fields = [
            'id', 'name', 'total_participants', 'current_participants',
            'status', 'start_date', 'end_date', 'game_area_name'
        ]
    
    def get_current_participants(self, obj):
        return obj.participants.count()


class RoomDetailSerializer(serializers.ModelSerializer):
    """방 상세 Serializer"""
    creator = UserSerializer(read_only=True)
    game_area = GameAreaListSerializer(read_only=True)
    participants = ParticipantSerializer(many=True, read_only=True)
    current_participants = serializers.SerializerMethodField()
    team_a_count = serializers.SerializerMethodField()
    team_b_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Room
        fields = [
            'id', 'name', 'creator', 'total_participants', 'current_participants',
            'team_a_count', 'team_b_count', 'start_date', 'end_date',
            'status', 'invite_code', 'game_area', 'current_hex_ownerships',
            'mvp', 'winner_team', 'participants', 'created_at', 'updated_at'
        ]
    
    def get_current_participants(self, obj):
        return obj.participants.count()
    
    def get_team_a_count(self, obj):
        return obj.participants.filter(team='A').count()
    
    def get_team_b_count(self, obj):
        return obj.participants.filter(team='B').count()


class RoomCreateSerializer(serializers.ModelSerializer):
    """방 생성 Serializer"""
    game_area_id = serializers.UUIDField(write_only=True)
    start_date = serializers.DateTimeField(
        input_formats=[
            '%Y-%m-%dT%H:%M',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
            'iso-8601',
        ]
    )
    end_date = serializers.DateTimeField(
        input_formats=[
            '%Y-%m-%dT%H:%M',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
            'iso-8601',
        ]
    )
    
    class Meta:
        model = Room
        fields = ['name', 'total_participants', 'start_date', 'end_date', 'game_area_id']
    
    def validate_total_participants(self, value):
        if value <= 0:
            raise serializers.ValidationError('총 인원수는 1 이상이어야 합니다.')
        if value % 2 != 0:
            raise serializers.ValidationError('총 인원수는 짝수여야 합니다.')
        return value
    
    def validate_game_area_id(self, value):
        try:
            game_area = GameArea.objects.get(id=value)
            if not game_area.is_active:
                raise serializers.ValidationError('비활성화된 게임 구역은 선택할 수 없습니다.')
        except GameArea.DoesNotExist:
            raise serializers.ValidationError('게임 구역을 찾을 수 없습니다.')
        return value
    
    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError('시작 일시가 종료 일시보다 늦을 수 없습니다.')
        return attrs
    
    def create(self, validated_data):
        game_area_id = validated_data.pop('game_area_id')
        game_area = GameArea.objects.get(id=game_area_id)
        room = Room.objects.create(game_area=game_area, **validated_data)
        return room


class RunningRecordSerializer(serializers.ModelSerializer):
    """러닝 기록 Serializer"""
    pace_display = serializers.ReadOnlyField()
    
    class Meta:
        model = RunningRecord
        fields = [
            'id', 'room', 'duration_seconds', 'distance_meters',
            'avg_pace_seconds_per_km', 'pace_display',
            'started_at', 'ended_at', 'created_at'
        ]
        read_only_fields = ['id', 'avg_pace_seconds_per_km', 'pace_display', 'created_at']


class RunningRecordStartSerializer(serializers.Serializer):
    """러닝 기록 시작 Serializer"""
    room_id = serializers.UUIDField(required=False, allow_null=True)


class RunningRecordStopSerializer(serializers.Serializer):
    """러닝 기록 종료 Serializer (선택적 필드 - 백엔드에서 계산)"""
    # 모든 필드는 선택적: 백엔드에서 자동 계산
    # 프론트엔드에서 제공하면 해당 값 사용, 없으면 백엔드 계산값 사용
    duration_seconds = serializers.IntegerField(min_value=0, required=False)
    distance_meters = serializers.FloatField(min_value=0, required=False)


class RunningStatsSerializer(serializers.Serializer):
    """러닝 통계 Serializer"""
    period = serializers.CharField()
    total_distance_meters = serializers.FloatField()
    total_duration_seconds = serializers.IntegerField()
    total_runs = serializers.IntegerField()
    avg_pace_seconds_per_km = serializers.FloatField(allow_null=True)
