"""
Management command for running simulation
"""
import asyncio
import json
import random
from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.auth import get_user_model
from apps.sessions.models import Session, Participant, Team
from apps.debugtools.simulators.route_parser import RouteParser
from apps.debugtools.simulators.websocket_client import SimulatorWebSocketClient
from apps.debugtools.simulators.bot_controller import BotController
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class Command(BaseCommand):
    help = 'Simulate running bots on a route'
    
    def add_arguments(self, parser):
        parser.add_argument('--session_id', type=str, required=True, help='Session UUID')
        parser.add_argument('--route_file', type=str, required=True, help='Path to route JSON file')
        parser.add_argument('--bots', type=int, default=1, help='Number of bots')
        parser.add_argument('--speed_mps', type=float, default=2.8, help='Speed in m/s')
        parser.add_argument('--tick', type=float, default=1.0, help='Tick interval in seconds')
        parser.add_argument('--jitter', type=float, default=3.0, help='GPS jitter in meters')
        parser.add_argument('--seed', type=int, default=None, help='Random seed')
        parser.add_argument('--loop_count', type=int, default=1, help='Number of route loops')
        parser.add_argument('--duration_limit', type=int, default=None, help='Duration limit in seconds')
        parser.add_argument('--ws_url', type=str, default='ws://localhost:8000', help='WebSocket URL')
    
    def handle(self, *args, **options):
        if not settings.DEBUG:
            self.stdout.write(self.style.ERROR('Simulator only works in DEBUG mode'))
            return
        
        session_id = options['session_id']
        route_file = options['route_file']
        num_bots = options['bots']
        speed_mps = options['speed_mps']
        tick_interval = options['tick']
        jitter = options['jitter']
        random_seed = options['seed']
        loop_count = options['loop_count']
        duration_limit = options['duration_limit']
        ws_url = options['ws_url']
        
        # Parse route
        self.stdout.write(f'[Simulator] Parsing route: {route_file}')
        try:
            if route_file.endswith('.geojson'):
                route = RouteParser.parse_geojson_route(route_file)
            else:
                route = RouteParser.parse_json_route(route_file)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error parsing route: {e}'))
            return
        
        # Interpolate waypoints
        route['waypoints'] = RouteParser.interpolate_waypoints(route['waypoints'], interval_m=10.0)
        
        self.stdout.write(f'[Simulator] Route: {route["name"]} ({len(route["waypoints"])} waypoints)')
        
        # Get session
        try:
            session = Session.objects.get(id=session_id)
        except Session.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Session {session_id} not found'))
            return
        
        # Get or create bot users
        bot_users = []
        for i in range(num_bots):
            username = f'bot_{i+1}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={'email': f'{username}@example.com'}
            )
            bot_users.append(user)
        
        # Get teams
        teams = list(session.teams.all())
        if not teams:
            self.stdout.write(self.style.ERROR('No teams in session'))
            return
        
        # Run simulation
        self.stdout.write(f'[Simulator] Starting simulation with {num_bots} bots...')
        asyncio.run(self.run_simulation(
            session, route, bot_users, teams, speed_mps, tick_interval,
            jitter, random_seed, loop_count, duration_limit, ws_url
        ))
    
    async def run_simulation(
        self, session, route, bot_users, teams, speed_mps, tick_interval,
        jitter, random_seed, loop_count, duration_limit, ws_url
    ):
        """Run the simulation"""
        bots = []
        websocket_clients = []
        
        # Create participants and WebSocket clients
        for i, user in enumerate(bot_users):
            team = teams[i % len(teams)]
            
            # Create participant
            participant, created = Participant.objects.get_or_create(
                session=session,
                user=user,
                defaults={'team': team, 'status': 'joined'}
            )
            if not created:
                participant.team = team
                participant.status = 'joined'
                participant.save()
            
            # Get access token
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            
            # Create WebSocket client
            ws_client = SimulatorWebSocketClient(
                ws_url, str(session.id), str(participant.id), access_token
            )
            
            # Connect
            try:
                connected = await ws_client.connect()
                if not connected:
                    self.stdout.write(self.style.ERROR(f'Bot {i+1} failed to connect'))
                    continue
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Bot {i+1} connection error: {e}'))
                continue
            
            websocket_clients.append(ws_client)
            
            # Create bot controller
            bot = BotController(
                bot_id=i+1,
                route=route,
                websocket_client=ws_client,
                speed_mps=speed_mps,
                tick_interval_sec=tick_interval,
                jitter_m=jitter,
                random_seed=random_seed
            )
            bots.append(bot)
            
            self.stdout.write(f'[Bot-{i+1}] Connected to WebSocket')
        
        # Run all bots concurrently
        tasks = [bot.run(duration_limit, loop_count) for bot in bots]
        await asyncio.gather(*tasks)
        
        # Collect results
        self.stdout.write('\n[Simulator] Simulation completed\n')
        self.stdout.write('[Simulator] Results:')
        
        for i, bot in enumerate(bots):
            stats = bot.stats
            duration = (stats['end_time'] - stats['start_time']).total_seconds() if stats['end_time'] else 0
            
            claims = bot.websocket_client.get_events_by_type('claim_hex')
            loops = bot.websocket_client.get_events_by_type('loop_complete')
            
            self.stdout.write(f'  Bot-{i+1}:')
            self.stdout.write(f'    - Duration: {duration:.1f}s')
            self.stdout.write(f'    - Distance: {stats["distance_traveled_m"]:.1f}m')
            self.stdout.write(f'    - Claims: {len(claims)}')
            self.stdout.write(f'    - Loops: {len(loops)}')
        
        # Disconnect all
        for ws_client in websocket_clients:
            await ws_client.disconnect()

