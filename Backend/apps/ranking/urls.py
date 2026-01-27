from django.urls import path

from apps.ranking import views


urlpatterns = [
    path('ranking/', views.ranking_list, name='ranking_list'),
    path('ranking/me/', views.my_ranking, name='my_ranking'),
    path('users/<uuid:user_id>/stats/', views.user_stats, name='user_stats'),
]
