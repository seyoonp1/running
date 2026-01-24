"""
Leaderboard views
"""
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.sessions.models import Session, PlayerStats
from apps.sessions.serializers import PlayerStatsSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def leaderboard(request):
    """Get leaderboard"""
    session_id = request.query_params.get('session_id')
    
    if session_id:
        # Session-specific leaderboard
        stats = PlayerStats.objects.filter(session_id=session_id).order_by('-mvp_score')
    else:
        # Global leaderboard (all finished sessions)
        finished_sessions = Session.objects.filter(status='finished')
        stats = PlayerStats.objects.filter(session__in=finished_sessions).order_by('-mvp_score')
    
    serializer = PlayerStatsSerializer(stats[:100], many=True)  # Top 100
    return Response({
        'leaderboard': serializer.data
    })

