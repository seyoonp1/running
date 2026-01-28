"""
Ranking views - MVP 버전
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User


def _build_stats(user, rank=None):
    win_rate = (user.games_won / user.games_played * 100) if user.games_played else 0.0
    data = {
        'user_id': str(user.id),
        'username': user.username,
        'rating': user.rating,
        'games_played': user.games_played,
        'games_won': user.games_won,
        'games_lost': user.games_lost,
        'games_draw': user.games_draw,
        'win_rate': round(win_rate, 2),
        'mvp_count': user.mvp_count,
        'highest_rating': user.highest_rating,
    }
    if rank is not None:
        data['rank'] = rank
    return data


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ranking_list(request):
    """
    전체 랭킹 리스트 (공동 순위 처리)
    GET /api/ranking/
    """
    try:
        limit = int(request.query_params.get('limit', 100))
    except ValueError:
        limit = 100
    limit = max(1, min(limit, 200))

    users = User.objects.order_by('-rating')[:limit]
    results = []
    
    current_rank = 1
    previous_rating = None
    
    for idx, user in enumerate(users, start=1):
        # 이전 사람과 점수가 다를 때만 등수를 갱신 (공동 순위 처리)
        if previous_rating is not None and user.rating < previous_rating:
            current_rank = idx
            
        results.append(_build_stats(user, rank=current_rank))
        previous_rating = user.rating

    return Response({
        'results': results,
        'count': len(results),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_ranking(request):
    """내 랭킹 정보"""
    user = request.user
    rank = User.objects.filter(rating__gt=user.rating).count() + 1
    return Response(_build_stats(user, rank=rank))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request, user_id):
    """특정 유저 통계"""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '사용자를 찾을 수 없습니다.'}, status=404)

    rank = User.objects.filter(rating__gt=user.rating).count() + 1
    return Response(_build_stats(user, rank=rank))
