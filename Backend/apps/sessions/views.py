"""
Session views
"""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import Session, Team, Participant, HexOwnership, EventLog, ChatMessage
from .serializers import (
    SessionSerializer, SessionStateSerializer, SessionJoinSerializer,
    TeamSerializer, ParticipantSerializer, HexOwnershipSerializer,
    ChatMessageSerializer, ChatMessageCreateSerializer
)


class SessionListCreateView(generics.ListCreateAPIView):
    """List and create sessions"""
    permission_classes = [IsAuthenticated]
    serializer_class = SessionSerializer
    
    def get_queryset(self):
        return Session.objects.filter(status__in=['waiting', 'active'])
    
    def perform_create(self, serializer):
        session = serializer.save()
        # Create default teams
        Team.objects.create(session=session, name="Team A", color="#FF0000")
        Team.objects.create(session=session, name="Team B", color="#0000FF")


class SessionDetailView(generics.RetrieveAPIView):
    """Session detail"""
    permission_classes = [IsAuthenticated]
    queryset = Session.objects.all()
    serializer_class = SessionSerializer
    lookup_field = 'id'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_session(request, id):
    """Join a session"""
    try:
        session = Session.objects.get(id=id, status__in=['waiting', 'active'])
        serializer = SessionJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        team_id = serializer.validated_data.get('team_id')
        if team_id:
            team = Team.objects.get(id=team_id, session=session)
        else:
            # Auto-assign to team with fewer members
            team = session.teams.order_by('members__count').first()
        
        participant, created = Participant.objects.get_or_create(
            session=session,
            user=request.user,
            defaults={'team': team, 'status': 'joined'}
        )
        
        if not created:
            participant.team = team
            participant.status = 'joined'
            participant.save()
        
        # Log event
        EventLog.objects.create(
            session=session,
            event_type='join',
            participant=participant,
            team=team
        )
        
        return Response({
            'participant_id': participant.id,
            'session_id': session.id,
            'team': TeamSerializer(team).data,
            'joined_at': participant.joined_at
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    except Team.DoesNotExist:
        return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def session_state(request, id):
    """Get session initial state"""
    try:
        session = Session.objects.get(id=id)
        
        return Response(SessionStateSerializer({
            'session': session,
            'teams': session.teams.all(),
            'participants': session.participants.filter(status__in=['joined', 'active']),
            'hex_ownerships': session.hex_ownerships.all()[:1000],  # Limit for performance
        }).data)
    
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_session(request, id):
    """Leave a session"""
    try:
        session = Session.objects.get(id=id)
        participant = Participant.objects.get(session=session, user=request.user)
        participant.status = 'left'
        participant.save()
        
        # Log event
        EventLog.objects.create(
            session=session,
            event_type='leave',
            participant=participant,
            team=participant.team
        )
        
        return Response({'message': 'Left session successfully'})
    
    except (Session.DoesNotExist, Participant.DoesNotExist):
        return Response({'error': 'Session or participant not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chat_messages(request, id):
    """Get chat messages for a session"""
    try:
        session = Session.objects.get(id=id)
        participant = Participant.objects.get(session=session, user=request.user)
        
        # Get team ID from query params (optional)
        team_id = request.query_params.get('team_id')
        
        # If team_id provided, only get messages for that team
        # Otherwise, get all messages for the session
        if team_id:
            messages = ChatMessage.objects.filter(
                session=session,
                team_id=team_id
            ).order_by('-created_at')[:100]
        else:
            messages = ChatMessage.objects.filter(
                session=session
            ).order_by('-created_at')[:100]
        
        return Response({
            'messages': ChatMessageSerializer(messages, many=True).data
        })
    
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    except Participant.DoesNotExist:
        return Response({'error': 'Not a participant in this session'}, status=status.HTTP_403_FORBIDDEN)
