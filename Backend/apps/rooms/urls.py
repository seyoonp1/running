"""
Room URLs
"""
from django.urls import path
from . import views

urlpatterns = [
    path('', views.RoomListCreateView.as_view(), name='room-list-create'),
    path('<uuid:id>/', views.RoomDetailView.as_view(), name='room-detail'),
    path('<uuid:id>/invite/', views.generate_invite, name='room-invite'),
]

