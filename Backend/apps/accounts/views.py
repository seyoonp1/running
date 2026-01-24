"""
Account views
"""
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from .models import User, Friendship
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    FriendshipSerializer, FriendRequestSerializer
)


class RegisterView(generics.CreateAPIView):
    """User registration"""
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """User login"""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Get current user"""
    return Response({
        'user': UserSerializer(request.user).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_friend_request(request):
    """Send friend request"""
    serializer = FriendRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    username = serializer.validated_data.get('username')
    user_id = serializer.validated_data.get('user_id')
    
    # Find target user
    try:
        if username:
            target_user = User.objects.get(username=username)
        else:
            target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if target_user == request.user:
        return Response({'error': 'Cannot add yourself as a friend'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if friendship already exists
    existing = Friendship.objects.filter(
        Q(requester=request.user, addressee=target_user) |
        Q(requester=target_user, addressee=request.user)
    ).first()
    
    if existing:
        if existing.status == 'accepted':
            return Response({'error': 'Already friends'}, status=status.HTTP_400_BAD_REQUEST)
        elif existing.status == 'pending':
            if existing.requester == request.user:
                return Response({'error': 'Friend request already sent'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Accept existing request
                existing.status = 'accepted'
                existing.save()
                return Response({
                    'message': 'Friend request accepted',
                    'friendship': FriendshipSerializer(existing).data
                })
    
    # Create new friend request
    friendship = Friendship.objects.create(
        requester=request.user,
        addressee=target_user,
        status='pending'
    )
    
    return Response({
        'message': 'Friend request sent',
        'friendship': FriendshipSerializer(friendship).data
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_friend_request(request, friendship_id):
    """Accept friend request"""
    try:
        friendship = Friendship.objects.get(
            id=friendship_id,
            addressee=request.user,
            status='pending'
        )
        friendship.status = 'accepted'
        friendship.save()
        return Response({
            'message': 'Friend request accepted',
            'friendship': FriendshipSerializer(friendship).data
        })
    except Friendship.DoesNotExist:
        return Response({'error': 'Friend request not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_friend_request(request, friendship_id):
    """Reject or remove friend request"""
    try:
        friendship = Friendship.objects.get(
            id=friendship_id,
            addressee=request.user,
            status='pending'
        )
        friendship.delete()
        return Response({'message': 'Friend request rejected'})
    except Friendship.DoesNotExist:
        return Response({'error': 'Friend request not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_friend(request, friendship_id):
    """Remove friend"""
    try:
        friendship = Friendship.objects.get(
            id=friendship_id,
            status='accepted'
        )
        # Check if user is part of this friendship
        if friendship.requester != request.user and friendship.addressee != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        
        friendship.delete()
        return Response({'message': 'Friend removed'})
    except Friendship.DoesNotExist:
        return Response({'error': 'Friendship not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def friends_list(request):
    """Get friends list"""
    friendships = Friendship.objects.filter(
        status='accepted'
    ).filter(
        Q(requester=request.user) | Q(addressee=request.user)
    )
    
    friends = []
    for friendship in friendships:
        if friendship.requester == request.user:
            friend_user = friendship.addressee
        else:
            friend_user = friendship.requester
        
        friends.append({
            'friendship_id': str(friendship.id),
            'user': UserSerializer(friend_user).data,
            'friends_since': friendship.updated_at
        })
    
    return Response({'friends': friends})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def friend_requests(request):
    """Get pending friend requests"""
    sent = Friendship.objects.filter(
        requester=request.user,
        status='pending'
    )
    received = Friendship.objects.filter(
        addressee=request.user,
        status='pending'
    )
    
    return Response({
        'sent': [FriendshipSerializer(f).data for f in sent],
        'received': [FriendshipSerializer(f).data for f in received]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    """Search users by username"""
    query = request.query_params.get('q', '')
    if not query or len(query) < 2:
        return Response({'error': 'Query must be at least 2 characters'}, status=status.HTTP_400_BAD_REQUEST)
    
    users = User.objects.filter(username__icontains=query)[:20]
    
    # Get friendship status for each user
    result = []
    for user in users:
        if user == request.user:
            continue
        
        friendship = Friendship.objects.filter(
            Q(requester=request.user, addressee=user) |
            Q(requester=user, addressee=request.user)
        ).first()
        
        result.append({
            'user': UserSerializer(user).data,
            'friendship_status': friendship.status if friendship else None,
            'friendship_id': str(friendship.id) if friendship else None
        })
    
    return Response({'users': result})
