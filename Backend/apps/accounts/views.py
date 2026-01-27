"""
Account views - MVP 버전
"""
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q, Count
from .models import User, Friendship, Mailbox
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    FriendshipSerializer, FriendRequestSerializer
)


# ==================== 인증 API ====================

class RegisterView(generics.CreateAPIView):
    """
    1. 회원가입
    POST /api/auth/register/
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'created_at': user.created_at,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    2. 로그인
    POST /api/auth/login/
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    
    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': str(user.id),
            'username': user.username,
            'email': user.email
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    4. 내 정보 조회
    GET /api/auth/me/
    """
    user = request.user
    return Response({
        'id': str(user.id),
        'username': user.username,
        'email': user.email,
        'created_at': user.created_at,
        'rating': user.rating,
        'games_played': user.games_played,
        'games_won': user.games_won,
        'games_lost': user.games_lost,
        'games_draw': user.games_draw,
        'mvp_count': user.mvp_count,
        'highest_rating': user.highest_rating
    })


# ==================== 친구 API ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def friends_list(request):
    """
    18. 친구 목록
    GET /api/friends/
    """
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
            'id': str(friend_user.id),
            'username': friend_user.username,
            'email': friend_user.email
        })
    
    return Response({
        'count': len(friends),
        'results': friends
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    """
    19. 친구 검색 (닉네임)
    GET /api/friends/search/?q={username}
    """
    query = request.query_params.get('q', '')
    if not query or len(query) < 2:
        return Response({'error': 'INVALID_INPUT', 'message': '검색어는 2자 이상이어야 합니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)[:20]
    
    return Response({
        'results': [
            {'id': str(u.id), 'username': u.username}
            for u in users
        ]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_friend_request(request):
    """
    20. 친구 요청
    POST /api/friends/request/
    """
    user_id = request.data.get('user_id')
    
    if not user_id:
        return Response({'error': 'INVALID_INPUT', 'message': 'user_id가 필요합니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '사용자를 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    if target_user == request.user:
        return Response({'error': 'INVALID_INPUT', 'message': '자기 자신에게 친구 요청을 보낼 수 없습니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # 기존 친구 관계 확인
    existing = Friendship.objects.filter(
        Q(requester=request.user, addressee=target_user) |
        Q(requester=target_user, addressee=request.user)
    ).first()
    
    if existing:
        if existing.status == 'accepted':
            return Response({'error': 'ALREADY_FRIENDS', 'message': '이미 친구입니다.'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        elif existing.status == 'pending':
            if existing.requester == request.user:
                return Response({'error': 'ALREADY_SENT', 'message': '이미 친구 요청을 보냈습니다.'}, 
                               status=status.HTTP_400_BAD_REQUEST)
            else:
                # 상대방이 먼저 요청한 경우, 자동 수락
                existing.status = 'accepted'
                existing.save(update_fields=['status'])
                return Response({'message': '친구 요청을 수락했습니다.'})
    
    # 친구 요청 생성
    friendship = Friendship.objects.create(
        requester=request.user,
        addressee=target_user,
        status='pending'
    )
    
    # 우편함에 친구 요청 메일 생성
    Mailbox.objects.create(
        sender=request.user,
        receiver=target_user,
        mail_type='friend_request',
        friendship=friendship,
        status='unread'
    )
    
    return Response({'message': '친구 요청을 보냈습니다.'}, status=status.HTTP_201_CREATED)


# ==================== 우편함 API ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mailbox_list(request):
    """
    22. 우편함 목록
    GET /api/mailbox/
    """
    mails = Mailbox.objects.filter(receiver=request.user).select_related(
        'sender', 'room', 'friendship'
    )[:100]
    
    results = []
    for mail in mails:
        item = {
            'id': str(mail.id),
            'sender': {
                'id': str(mail.sender.id),
                'username': mail.sender.username
            } if mail.sender else None,
            'mail_type': mail.mail_type,
            'friendship_id': str(mail.friendship.id) if mail.friendship else None,
            'room': {
                'id': str(mail.room.id),
                'name': mail.room.name
            } if mail.room else None,
            'status': mail.status,
            'created_at': mail.created_at
        }
        results.append(item)
    
    return Response({
        'count': len(results),
        'results': results
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mailbox_respond(request, id):
    """
    21. 우편 수락/거절 (친구 요청 및 방 초대 통합)
    POST /api/mailbox/{id}/respond/
    
    - 친구 요청과 방 초대 모두 이 API로 처리
    - accept=true 시 수락, accept=false 시 거절
    - 방 초대 수락 시 팀은 자동 배정 (인원이 적은 팀으로)
    """
    accept = request.data.get('accept', False)
    
    try:
        mail = Mailbox.objects.get(id=id, receiver=request.user)
    except Mailbox.DoesNotExist:
        return Response({'error': 'NOT_FOUND', 'message': '메일을 찾을 수 없습니다.'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    if mail.status in ['accepted', 'rejected']:
        return Response({'error': 'ALREADY_PROCESSED', 'message': '이미 처리된 메일입니다.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    if accept:
        if mail.mail_type == 'friend_request':
            # 친구 요청 수락
            if mail.friendship:
                if mail.friendship.status == 'pending':
                    mail.friendship.status = 'accepted'
                    mail.friendship.save(update_fields=['status'])
                elif mail.friendship.status == 'accepted':
                    mail.status = 'accepted'
                    mail.save(update_fields=['status'])
                    return Response({'message': '이미 친구입니다.'})
            mail.status = 'accepted'
            mail.save(update_fields=['status'])
            return Response({'message': '친구 요청을 수락했습니다.'})
        
        elif mail.mail_type == 'room_invite':
            # 방 초대 수락
            if not mail.room:
                mail.status = 'rejected'
                mail.save(update_fields=['status'])
                return Response({'error': 'ROOM_NOT_FOUND', 'message': '방을 찾을 수 없습니다.'}, 
                               status=status.HTTP_400_BAD_REQUEST)
            
            room = mail.room
            
            # 방 상태 확인
            if room.status != 'ready':
                return Response({'error': 'ROOM_NOT_READY', 'message': '방이 준비 상태가 아닙니다.'}, 
                               status=status.HTTP_403_FORBIDDEN)
            
            # 정원 확인
            if room.current_participants_count >= room.total_participants:
                return Response({'error': 'ROOM_FULL', 'message': '방 정원이 초과되었습니다.'}, 
                               status=status.HTTP_403_FORBIDDEN)
            
            # 이미 참가 중인지 확인
            from apps.rooms.models import Participant
            if Participant.objects.filter(room=room, user=request.user).exists():
                mail.status = 'accepted'
                mail.save(update_fields=['status'])
                return Response({'message': '이미 참가 중입니다.'})
            
            # 팀 자동 배정 (인원이 적은 팀으로)
            team_a_count = room.team_a_count
            team_b_count = room.team_b_count
            max_per_team = room.total_participants // 2
            
            if team_a_count <= team_b_count and team_a_count < max_per_team:
                team = 'A'
            elif team_b_count < max_per_team:
                team = 'B'
            else:
                return Response({'error': 'ROOM_FULL', 'message': '방 정원이 초과되었습니다.'}, 
                               status=status.HTTP_403_FORBIDDEN)
            
            # 참가자 생성
            participant = Participant.objects.create(
                room=room,
                user=request.user,
                team=team,
                is_host=False
            )
            
            mail.status = 'accepted'
            mail.save(update_fields=['status'])
            
            from apps.rooms.serializers import RoomDetailSerializer, ParticipantSerializer
            return Response({
                'message': f'초대를 수락했습니다. {team}팀에 배정되었습니다.',
                'room': RoomDetailSerializer(room).data,
                'participant': ParticipantSerializer(participant).data
            })
    else:
        # 거절
        if mail.mail_type == 'friend_request' and mail.friendship:
            # 친구 요청 거절 시 Friendship 레코드도 삭제
            mail.friendship.delete()
        
        mail.status = 'rejected'
        mail.save(update_fields=['status'])
        
        if mail.mail_type == 'friend_request':
            return Response({'message': '친구 요청을 거절했습니다.'})
        else:
            return Response({'message': '초대를 거절했습니다.'})
