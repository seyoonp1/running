import logging

from celery import shared_task
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from apps.rooms.models import Room
from apps.ranking.services import RankingService


logger = logging.getLogger(__name__)


@shared_task
def check_and_end_games():
    """end_date가 지난 게임들을 종료 처리"""
    now = timezone.now()
    expired_rooms = Room.objects.filter(status='active', end_date__lt=now)

    for room in expired_rooms:
        process_game_end.delay(str(room.id))


@shared_task
def process_game_end(room_id):
    """게임 종료 처리 및 레이팅 업데이트"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        logger.warning("Room not found for game end: %s", room_id)
        return False

    service = RankingService()
    result = service.process_game_end(room)
    if not result:
        return True

    channel_layer = get_channel_layer()
    payload = {
        'type': 'game_ended',
        'room_id': str(room.id),
        'winner_team': result.get('winner_team'),
        'mvp_id': str(result['mvp_user'].id) if result.get('mvp_user') else None,
        'mvp_username': result['mvp_user'].username if result.get('mvp_user') else None,
        'team_a_count': result.get('team_a_count'),
        'team_b_count': result.get('team_b_count'),
        'timestamp': timezone.now().isoformat(),
    }

    async_to_sync(channel_layer.group_send)(
        f'room_{room.id}',
        payload,
    )
    return True
