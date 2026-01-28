import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('running')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# 게임 시작 시 end_date에 맞춰 태스크 예약 (주 방식)
# 안전장치: 주기적으로 end_date가 지난 게임들을 체크하여 종료 처리
app.conf.beat_schedule = {
    'check-game-end': {
        'task': 'apps.ranking.tasks.check_and_end_games',
        'schedule': crontab(minute='*'),  # 매분마다 실행
    },
}
