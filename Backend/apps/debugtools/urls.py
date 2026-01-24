"""
Debug tools URLs
"""
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.conf import settings

# Only enable in DEBUG mode
if settings.DEBUG:
    @api_view(['POST'])
    @permission_classes([IsAdminUser])
    @csrf_exempt
    def simulate_api(request):
        """API endpoint for simulation (alternative to management command)"""
        # This would trigger the simulation
        # For now, just return info
        return Response({
            'message': 'Use management command: python manage.py simulate_run',
            'usage': 'python manage.py simulate_run --session_id <uuid> --route_file <path>'
        })
    
    urlpatterns = [
        path('simulate/', simulate_api, name='debug-simulate'),
    ]
else:
    urlpatterns = []

