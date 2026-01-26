"""
Leaderboard views - MVP 버전
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum
from apps.rooms.models import Room, Participant


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leaderboard(request):
    """
    리더보드 조회
    GET /api/leaderboard/
    
    쿼리 파라미터:
    - room_id: 특정 방의 리더보드 (선택)
    - type: 'team' (팀별) 또는 'user' (개인별), 기본값: 'team'
    """
    room_id = request.query_params.get('room_id')
    leaderboard_type = request.query_params.get('type', 'team')
    
    if room_id:
        # 특정 방의 리더보드
        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({'error': 'NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, status=404)
        
        ownerships = room.current_hex_ownerships or {}
        
        if leaderboard_type == 'team':
            # 팀별 점수
            team_a_count = sum(1 for h in ownerships.values() if h.get('team') == 'A')
            team_b_count = sum(1 for h in ownerships.values() if h.get('team') == 'B')
            
            return Response({
                'room_id': str(room.id),
                'type': 'team',
                'results': [
                    {'team': 'A', 'hex_count': team_a_count},
                    {'team': 'B', 'hex_count': team_b_count}
                ]
            })
        else:
            # 개인별 점수
            user_counts = {}
            for hex_data in ownerships.values():
                user_id = hex_data.get('user_id')
                if user_id:
                    user_counts[user_id] = user_counts.get(user_id, 0) + 1
            
            # 참가자 정보와 함께 반환
            participants = Participant.objects.filter(room=room).select_related('user')
            user_map = {str(p.user_id): p for p in participants}
            
            results = []
            for user_id, count in sorted(user_counts.items(), key=lambda x: -x[1]):
                participant = user_map.get(user_id)
                if participant:
                    results.append({
                        'user_id': user_id,
                        'username': participant.user.username,
                        'team': participant.team,
                        'hex_count': count
                    })
            
            return Response({
                'room_id': str(room.id),
                'type': 'user',
                'results': results
            })
    
    else:
        # 전체 리더보드 (완료된 게임 기준)
        # MVP에서는 단순히 최근 완료된 게임들의 MVP 목록 반환
        rooms = Room.objects.filter(
            status='finished',
            mvp__isnull=False
        ).select_related('mvp').order_by('-updated_at')[:20]
        
        results = []
        for room in rooms:
            results.append({
                'room_id': str(room.id),
                'room_name': room.name,
                'mvp_id': str(room.mvp.id),
                'mvp_username': room.mvp.username,
                'winner_team': room.winner_team,
                'finished_at': room.updated_at
            })
        
        return Response({
            'type': 'global',
            'results': results
        })
