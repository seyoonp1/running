"""
Account URLs
"""
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    # Friend endpoints
    path('friends/', views.friends_list, name='friends-list'),
    path('friends/requests/', views.friend_requests, name='friend-requests'),
    path('friends/request/', views.send_friend_request, name='send-friend-request'),
    path('friends/accept/<uuid:friendship_id>/', views.accept_friend_request, name='accept-friend-request'),
    path('friends/reject/<uuid:friendship_id>/', views.reject_friend_request, name='reject-friend-request'),
    path('friends/remove/<uuid:friendship_id>/', views.remove_friend, name='remove-friend'),
    path('users/search/', views.search_users, name='search-users'),
]
