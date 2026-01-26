"""
Room URLs - MVP 버전
"""
from django.urls import path
from . import views

urlpatterns = [
    # 게임 구역 API
    path('game-areas/', views.GameAreaListView.as_view(), name='game-area-list'),
    path('game-areas/<uuid:id>/', views.GameAreaDetailView.as_view(), name='game-area-detail'),
    
    # 방 API
    path('rooms/', views.RoomListCreateView.as_view(), name='room-list-create'),
    path('rooms/my/', views.my_current_room, name='room-my'),
    path('rooms/join/', views.join_room, name='room-join'),
    path('rooms/<uuid:id>/', views.RoomDetailView.as_view(), name='room-detail'),
    path('rooms/<uuid:id>/leave/', views.leave_room, name='room-leave'),
    path('rooms/<uuid:id>/change-team/', views.change_team, name='room-change-team'),
    path('rooms/<uuid:id>/start/', views.start_room, name='room-start'),
    path('rooms/<uuid:id>/invite/', views.invite_to_room, name='room-invite'),
    path('rooms/<uuid:id>/attendance/', views.attendance_status, name='room-attendance'),
    
    # 러닝 기록 API
    path('records/', views.RunningRecordListView.as_view(), name='record-list'),
    path('records/start/', views.start_record, name='record-start'),
    path('records/stats/', views.record_stats, name='record-stats'),
    path('records/<uuid:id>/stop/', views.stop_record, name='record-stop'),
]
