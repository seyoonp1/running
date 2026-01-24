"""
Session URLs
"""
from django.urls import path
from . import views

urlpatterns = [
    path('', views.SessionListCreateView.as_view(), name='session-list-create'),
    path('<uuid:id>/', views.SessionDetailView.as_view(), name='session-detail'),
    path('<uuid:id>/join/', views.join_session, name='session-join'),
    path('<uuid:id>/state/', views.session_state, name='session-state'),
    path('<uuid:id>/leave/', views.leave_session, name='session-leave'),
    path('<uuid:id>/chat/', views.chat_messages, name='chat-messages'),
]
