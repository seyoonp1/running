import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('running')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# 주기적 게임 종료 체크는 제거 (게임 시작 시 end_date에 맞춰 태스크 예약)
# 안전장치로 필요시 주석 해제 가능
# app.conf.beat_schedule = {
#     'check-game-end': {
#         'task': 'apps.ranking.tasks.check_and_end_games',
#         'schedule': crontab(minute='*'),
#     },
# }
