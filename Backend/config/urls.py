"""
URL configuration for hexgame backend.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/sessions/', include('apps.sessions.urls')),
    path('api/leaderboard/', include('apps.leaderboard.urls')),
]

if settings.DEBUG:
    urlpatterns += [
        path('api/debug/', include('apps.debugtools.urls')),
    ]

