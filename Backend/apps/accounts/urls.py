"""
Account URLs - MVP 버전
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # 인증 API
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', views.me, name='me'),
    
    # 친구 API
    path('friends/', views.friends_list, name='friends-list'),
    path('friends/search/', views.search_users, name='friends-search'),
    path('friends/request/', views.send_friend_request, name='friends-request'),
    # 친구 요청 수락/거절은 우편함 API (mailbox/{id}/respond/)로 통일
    
    # 우편함 API
    path('mailbox/', views.mailbox_list, name='mailbox-list'),
    path('mailbox/<uuid:id>/respond/', views.mailbox_respond, name='mailbox-respond'),
]
