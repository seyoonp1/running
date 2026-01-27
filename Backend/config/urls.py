"""
URL configuration for Running App Backend - MVP 버전
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # 인증 & 친구 & 우편함 API
    path('api/', include('apps.accounts.urls')),
    
    # 게임 구역 & 방 & 기록 API
    path('api/', include('apps.rooms.urls')),
    
    # 리더보드 API (예정)
    path('api/leaderboard/', include('apps.leaderboard.urls')),

    # 랭킹 API
    path('api/', include('apps.ranking.urls')),
]

if settings.DEBUG:
    urlpatterns += [
        path('api/debug/', include('apps.debugtools.urls')),
    ]
