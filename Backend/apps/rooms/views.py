"""
Room views
"""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import models
from .models import Room
from .serializers import RoomSerializer, RoomCreateSerializer
from apps.accounts.models import User, Friendship


class RoomListCreateView(generics.ListCreateAPIView):
    """List and create rooms"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Room.objects.filter(is_active=True)
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RoomCreateSerializer
        return RoomSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        room = serializer.save(creator=self.request.user)
        
        # Invite friends if provided
        friend_ids = serializer.validated_data.get('friend_ids', [])
        if friend_ids:
            # Get friend users
            friendships = Friendship.objects.filter(
                status='accepted'
            ).filter(
                models.Q(requester=self.request.user) | models.Q(addressee=self.request.user)
            )
            
            friend_users = []
            for friendship in friendships:
                if friendship.requester == self.request.user:
                    if friendship.addressee.id in friend_ids:
                        friend_users.append(friendship.addressee)
                else:
                    if friendship.requester.id in friend_ids:
                        friend_users.append(friendship.requester)
            
            # Store invited friends in room rules or create a separate model
            # For now, we'll store it in room.rules
            if 'invited_friends' not in room.rules:
                room.rules['invited_friends'] = []
            
            for friend in friend_users:
                room.rules['invited_friends'].append(str(friend.id))
            
            room.save()
        
        return room


class RoomDetailView(generics.RetrieveAPIView):
    """Room detail"""
    permission_classes = [IsAuthenticated]
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    lookup_field = 'id'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_invite(request, id):
    """Generate or get invite code"""
    try:
        room = Room.objects.get(id=id, creator=request.user)
        return Response({
            'invite_code': room.invite_code,
            'invite_url': f"/join/{room.invite_code}"
        })
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)
