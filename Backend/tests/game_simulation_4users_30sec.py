#!/usr/bin/env python
"""
게임 시뮬레이션 테스트 스크립트 (4명, 30초)

이 스크립트는 네 명의 사용자가 30초 동안 GPS로 이동하며 게임을 진행하고,
게임 시작/종료, 결과, 랭크 변화를 체크합니다.

사용법:
1. pip install websockets requests
2. python game_simulation_4users_30sec.py

테스트 시나리오:
1. 네 명의 사용자 생성 (user1~user4)
2. 친구 요청 및 수락
3. 방 생성 (start_date는 현재 시간으로 설정)
4. 모든 사용자 방 참가
5. 게임 시작
6. 각 사용자가 30초 동안 GPS 이동 시뮬레이션
7. 기록 시작/종료
8. 게임 결과 확인
9. 랭크 변화 확인
"""

import asyncio
import json
import requests
import websockets
import time
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# 서버 설정
BASE_URL = "http://44.196.254.97"
WS_URL = "ws://44.196.254.97"

# 테스트 설정
TEST_PREFIX = f"test_{int(time.time())}"
GAME_DURATION_SECONDS = 30  # 30초 게임
GPS_UPDATE_INTERVAL = 1.0  # 1초마다 GPS 업데이트
SPEED_MPS = 3.0  # 초당 3미터 (약 10.8 km/h)


def get_bounds_center(bounds: Dict) -> Optional[tuple]:
    """게임 구역 bounds의 중심 좌표 (lat, lng) 계산"""
    # 빈 dict나 None 체크
    if not bounds or (isinstance(bounds, dict) and len(bounds) == 0):
        return None

    if not isinstance(bounds, dict):
        return None

    # GeoJSON Polygon 형식 확인
    coords = None
    if bounds.get("type") == "Polygon":
        coords = bounds.get("coordinates")
    elif "coordinates" in bounds:
        # type이 없어도 coordinates가 있으면 사용
        coords = bounds.get("coordinates")

    if not coords:
        return None

    # coordinates는 리스트여야 함
    if not isinstance(coords, list) or len(coords) == 0:
        return None

    # 첫 번째 ring (외곽 경계) 사용
    ring = coords[0]
    if not isinstance(ring, list) or len(ring) == 0:
        return None

    lat_sum = 0.0
    lng_sum = 0.0
    count = 0
    for point in ring:
        if isinstance(point, list) and len(point) >= 2:
            lng_sum += point[0]  # GeoJSON은 [lng, lat] 순서
            lat_sum += point[1]
            count += 1

    if count == 0:
        return None

    return (lat_sum / count, lng_sum / count)


async def wait_for_ws_type(ws, expected_type: str, timeout: float = 5.0):
    """WebSocket에서 특정 타입 메시지를 받을 때까지 대기"""
    end_time = time.time() + timeout
    while time.time() < end_time:
        try:
            remaining = max(0.1, end_time - time.time())
            msg = await asyncio.wait_for(ws.recv(), timeout=remaining)
            data = json.loads(msg)
            if data.get("type") == expected_type:
                return data
        except asyncio.TimeoutError:
            break
        except json.JSONDecodeError:
            continue
    return None


class TestUser:
    """테스트 사용자 클래스"""

    def __init__(self, username, email, password):
        self.username = username
        self.email = email
        self.password = password
        self.access_token = None
        self.user_id = None
        self.initial_rating = None
        self.initial_rank = None
        self.final_rating = None
        self.final_rank = None
        self.record_id = None
        self.participant_id = None

    def register(self):
        """회원가입"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json={
                "username": self.username,
                "email": self.email,
                "password": self.password,
            },
        )
        if response.status_code == 201:
            data = response.json()
            self.user_id = data.get("id")
            print(f"✅ {self.username} 회원가입 성공 (ID: {self.user_id})")
            return True
        print(f"❌ {self.username} 회원가입 실패: {response.text}")
        return False

    def login(self):
        """로그인"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json={"username": self.username, "password": self.password},
        )
        if response.status_code == 200:
            data = response.json()
            self.access_token = data.get("access")
            print(f"✅ {self.username} 로그인 성공")
            return True
        print(f"❌ {self.username} 로그인 실패: {response.text}")
        return False

    def get_headers(self):
        """인증 헤더 반환"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def get_initial_ranking(self):
        """초기 랭킹 정보 저장"""
        response = requests.get(
            f"{BASE_URL}/api/ranking/me/", headers=self.get_headers()
        )
        if response.status_code == 200:
            data = response.json()
            self.initial_rating = data.get("rating", 1500)
            self.initial_rank = data.get("rank")
            print(
                f"📊 {self.username} 초기 랭킹: {self.initial_rank}위, 레이팅: {self.initial_rating}"
            )
            return True
        return False

    def get_final_ranking(self):
        """최종 랭킹 정보 저장"""
        response = requests.get(
            f"{BASE_URL}/api/ranking/me/", headers=self.get_headers()
        )
        if response.status_code == 200:
            data = response.json()
            self.final_rating = data.get("rating", 1500)
            self.final_rank = data.get("rank")
            rating_change = self.final_rating - self.initial_rating
            print(
                f"📊 {self.username} 최종 랭킹: {self.final_rank}위, 레이팅: {self.final_rating} "
                f"(변화: {rating_change:+.0f})"
            )
            return True
        return False


def accept_friend_request(user):
    """우편함에서 친구 요청을 찾아 수락"""
    response = requests.get(f"{BASE_URL}/api/mailbox/", headers=user.get_headers())
    if response.status_code != 200:
        print(f"❌ {user.username} 우편함 조회 실패: {response.text}")
        return False

    mailbox_data = response.json()
    mails = mailbox_data.get("results", [])

    friend_request_mail = None
    for mail in mails:
        if mail.get("mail_type") == "friend_request" and mail.get("status") in [
            "unread",
            "read",
        ]:
            friend_request_mail = mail
            break

    if not friend_request_mail:
        print(f"❌ {user.username} 친구 요청 메일을 찾을 수 없습니다.")
        return False

    mailbox_id = friend_request_mail.get("id")
    response = requests.post(
        f"{BASE_URL}/api/mailbox/{mailbox_id}/respond/",
        headers=user.get_headers(),
        json={"accept": True},
    )
    if response.status_code not in [200, 201]:
        print(f"❌ {user.username} 친구 요청 수락 실패: {response.text}")
        return False

    print(f"✅ {user.username} 친구 요청 수락 성공")
    return True


def accept_room_invite(user):
    """우편함에서 방 초대 메일을 찾아 수락"""
    response = requests.get(f"{BASE_URL}/api/mailbox/", headers=user.get_headers())
    if response.status_code != 200:
        print(f"❌ {user.username} 우편함 조회 실패: {response.text}")
        return False

    mailbox_data = response.json()
    mails = mailbox_data.get("results", [])

    room_invite_mail = None
    for mail in mails:
        if mail.get("mail_type") == "room_invite" and mail.get("status") in [
            "unread",
            "read",
        ]:
            room_invite_mail = mail
            break

    if not room_invite_mail:
        print(f"❌ {user.username} 방 초대 메일을 찾을 수 없습니다.")
        return False

    mailbox_id = room_invite_mail.get("id")
    response = requests.post(
        f"{BASE_URL}/api/mailbox/{mailbox_id}/respond/",
        headers=user.get_headers(),
        json={"accept": True},
    )
    if response.status_code not in [200, 201]:
        print(f"❌ {user.username} 초대 수락 실패: {response.text}")
        return False

    accept_data = response.json()
    print(f"✅ {user.username} 초대 수락 성공: {accept_data.get('message')}")
    if "participant" in accept_data:
        print(f"   배정된 팀: {accept_data['participant'].get('team')}")
    return True


def generate_gps_route(start_lat: float, start_lng: float, duration_sec: int, speed_mps: float):
    """
    GPS 경로 생성 (직선 이동)
    
    Args:
        start_lat: 시작 위도
        start_lng: 시작 경도
        duration_sec: 이동 시간 (초)
        speed_mps: 속도 (미터/초)
    
    Returns:
        List of (lat, lng) tuples
    """
    # 1도 위도 ≈ 111km, 1도 경도 ≈ 111km * cos(위도)
    lat_per_meter = 1.0 / 111000.0
    lng_per_meter = 1.0 / (111000.0 * math.cos(math.radians(start_lat)))
    
    total_distance = speed_mps * duration_sec  # 총 이동 거리 (미터)
    num_points = int(duration_sec / GPS_UPDATE_INTERVAL) + 1
    
    route = []
    for i in range(num_points):
        progress = i / (num_points - 1) if num_points > 1 else 0
        distance = total_distance * progress
        
        # 북쪽으로 직선 이동
        lat = start_lat + (distance * lat_per_meter)
        lng = start_lng  # 경도는 유지
        
        route.append((lat, lng))
    
    return route


async def simulate_user_movement(ws, user: TestUser, room_id: str, start_lat: float, start_lng: float):
    """
    사용자 GPS 이동 시뮬레이션
    
    Args:
        ws: WebSocket 연결
        user: 테스트 사용자
        room_id: 방 ID
        start_lat: 시작 위도
        start_lng: 시작 경도
    """
    # GPS 경로 생성
    route = generate_gps_route(start_lat, start_lng, GAME_DURATION_SECONDS, SPEED_MPS)
    
    print(f"🏃 {user.username} GPS 이동 시작 ({len(route)}개 포인트)")
    
    # WebSocket으로 start_recording 메시지 전송 (거리 계산 변수 초기화 + 기록 생성)
    await ws.send(json.dumps({"type": "start_recording"}))
    ws_data = await wait_for_ws_type(ws, "recording_started", timeout=5)
    if ws_data:
        user.record_id = ws_data.get("record_id")
        print(f"✅ {user.username} 기록 시작 (Record ID: {user.record_id})")
    else:
        print(f"❌ {user.username} 기록 시작 응답 타임아웃")
        return
    
    # WebSocket으로 위치 업데이트 전송
    start_time = time.time()
    for i, (lat, lng) in enumerate(route):
        elapsed = time.time() - start_time
        if elapsed >= GAME_DURATION_SECONDS:
            break
        
        # WebSocket으로 위치 전송
        await ws.send(
            json.dumps(
                {
                    "type": "loc",
                    "lat": lat,
                    "lng": lng,
                    "accuracy": 10.0,
                    "speed": SPEED_MPS,
                }
            )
        )
        
        # 마지막 포인트가 아니면 대기
        if i < len(route) - 1:
            await asyncio.sleep(GPS_UPDATE_INTERVAL)
    
    # 기록 종료 (WebSocket으로 거리 계산 및 저장)
    if user.record_id:
        # WebSocket으로 stop_recording 메시지 전송 (거리 계산 및 저장)
        await ws.send(json.dumps({"type": "stop_recording"}))
        ws_data = await wait_for_ws_type(ws, "recording_stopped", timeout=5)
        if ws_data:
            ws_distance = ws_data.get("distance_meters", 0)
            ws_duration = ws_data.get("duration_seconds", 0)
            print(
                f"✅ {user.username} 기록 종료 (WebSocket): {ws_duration}초, {ws_distance:.2f}m"
            )
        else:
            print(f"⚠️ {user.username} WebSocket 응답 타임아웃 (거리 계산은 완료되었을 수 있음)")


async def test_game_simulation_30sec():
    """30초 게임 시뮬레이션 테스트"""
    print("\n" + "=" * 70)
    print("🎮 게임 시뮬레이션 테스트 시작 (4명, 30초)")
    print("=" * 70 + "\n")

    # 1. 테스트 사용자 생성
    print("📌 Step 1: 테스트 사용자 생성")
    users = [
        TestUser(f"{TEST_PREFIX}_user1", f"{TEST_PREFIX}_user1@test.com", "testpassword123"),
        TestUser(f"{TEST_PREFIX}_user2", f"{TEST_PREFIX}_user2@test.com", "testpassword123"),
        TestUser(f"{TEST_PREFIX}_user3", f"{TEST_PREFIX}_user3@test.com", "testpassword123"),
        TestUser(f"{TEST_PREFIX}_user4", f"{TEST_PREFIX}_user4@test.com", "testpassword123"),
    ]

    for user in users:
        if not user.register() or not user.login():
            print(f"❌ {user.username} 설정 실패")
            return False

    user1 = users[0]

    # 2. 초기 랭킹 정보 저장
    print("\n📌 Step 2: 초기 랭킹 정보 저장")
    for user in users:
        user.get_initial_ranking()

    # 3. 친구 요청 (user1 -> user2~user4)
    print("\n📌 Step 3: 친구 요청 및 수락")
    for user in users[1:]:
        response = requests.post(
            f"{BASE_URL}/api/friends/request/",
            headers=user1.get_headers(),
            json={"user_id": str(user.user_id)},
        )
        if response.status_code not in [200, 201]:
            print(f"❌ {user.username} 친구 요청 실패: {response.text}")
            return False
        print(f"✅ {user.username} 친구 요청 전송 성공")

    for user in users[1:]:
        if not accept_friend_request(user):
            return False

    # 4. 게임 구역 조회
    print("\n📌 Step 4: 게임 구역 조회")
    response = requests.get(f"{BASE_URL}/api/game-areas/", headers=user1.get_headers())
    if response.status_code != 200:
        print(f"❌ 게임 구역 조회 실패: {response.text}")
        print("⚠️ 게임 구역이 없습니다. Django Admin에서 먼저 추가해주세요.")
        return False

    game_areas = response.json()
    results = game_areas.get("results", [])
    if not results:
        print("⚠️ 등록된 게임 구역이 없습니다. Django Admin에서 먼저 추가해주세요.")
        return False

    game_area_id = results[0]["id"]
    print(f"✅ 게임 구역 선택: {results[0]['name']}")
    selected_bounds = results[0].get("bounds", {})
    
    # 디버깅: bounds 구조 확인
    print(f"🔍 Debug - bounds 타입: {type(selected_bounds)}, 값: {selected_bounds}")
    if selected_bounds:
        print(f"🔍 Debug - bounds keys: {selected_bounds.keys() if isinstance(selected_bounds, dict) else 'N/A'}")
    
    center = get_bounds_center(selected_bounds)
    if center:
        base_lat, base_lng = center  # (위도, 경도) 순서
        print(f"✅ 게임 구역 중심 좌표 사용: 위도={base_lat:.6f}, 경도={base_lng:.6f}")
    else:
        base_lat, base_lng = 36.364838, 127.367953  # 대전 근처
        print("⚠️ 게임 구역 bounds 없음: 기본 좌표(서울) 사용")
        if selected_bounds:
            print(f"   💡 bounds는 있지만 파싱 실패: {selected_bounds}")

    # 5. 방 생성 (start_date는 현재 시간으로 설정)
    print("\n📌 Step 5: 방 생성")
    now = datetime.now().replace(second=0, microsecond=0)
    # end_date는 게임 시작 후 GAME_DURATION_SECONDS초 후로 설정
    end_at = now + timedelta(seconds=GAME_DURATION_SECONDS + 5)  # 5초 여유
    start_date = now.isoformat(timespec='seconds')
    end_date = end_at.isoformat(timespec='seconds')

    response = requests.post(
        f"{BASE_URL}/api/rooms/",
        headers=user1.get_headers(),
        json={
            "name": f"{TEST_PREFIX}_game_30sec",
            "total_participants": 4,
            "start_date": start_date,
            "end_date": end_date,
            "game_area_id": game_area_id,
        },
    )
    if response.status_code not in [200, 201]:
        print(f"❌ 방 생성 실패: {response.text}")
        return False

    room_data = response.json()
    room_id = room_data.get("id")
    print(f"✅ 방 생성 성공: {room_id}")
    print(f"   시작 일시: {start_date}")
    print(f"   종료 일시: {end_date}")

    # 6. user1이 user2~user4를 방에 초대
    print("\n📌 Step 6: User1이 User2~User4를 방에 초대")
    for user in users[1:]:
        response = requests.post(
            f"{BASE_URL}/api/rooms/{room_id}/invite/",
            headers=user1.get_headers(),
            json={"user_id": str(user.user_id)},
        )
        if response.status_code not in [200, 201]:
            print(f"❌ {user.username} 방 초대 실패: {response.text}")
            return False
        print(f"✅ {user.username} 초대 성공")

    # 7. user2~user4가 우편함에서 초대 확인 및 수락
    print("\n📌 Step 7: User2~User4가 초대 수락")
    for user in users[1:]:
        if not accept_room_invite(user):
            return False

    # 8. 방 상세 정보 확인 (participant_id 저장)
    print("\n📌 Step 8: 방 상세 정보 확인")
    response = requests.get(
        f"{BASE_URL}/api/rooms/{room_id}/", headers=user1.get_headers()
    )
    if response.status_code == 200:
        room_detail = response.json()
        participants = room_detail.get("participants", [])
        for p in participants:
            for user in users:
                if str(p.get("user_id")) == str(user.user_id):
                    user.participant_id = p.get("id")
                    print(f"✅ {user.username} participant_id: {user.participant_id}")
        print(f"   현재 참가자 수: {room_detail.get('current_participants', 0)}/4")

    # 9. 방장이 게임 시작
    print("\n📌 Step 9: 방장이 게임 시작")
    response = requests.post(
        f"{BASE_URL}/api/rooms/{room_id}/start/",
        headers=user1.get_headers(),
    )
    if response.status_code not in [200, 201]:
        print(f"❌ 게임 시작 실패: {response.text}")
        error_data = response.json()
        if error_data.get("error") == "NOT_START_DATE":
            print("   ⚠️ 시작 일시 검증 실패: 현재 시간이 시작 일시보다 이전입니다.")
        return False
    print("✅ 게임 시작 성공!")

    # 10. WebSocket 연결 및 GPS 이동 시뮬레이션
    print(f"\n📌 Step 10: 30초 동안 GPS 이동 시뮬레이션")
    print(f"   게임 시간: {GAME_DURATION_SECONDS}초")
    print(f"   GPS 업데이트 간격: {GPS_UPDATE_INTERVAL}초")
    print(f"   이동 속도: {SPEED_MPS} m/s (약 {SPEED_MPS * 3.6:.1f} km/h)")
    
    # 각 사용자의 시작 위치 (약간씩 다르게)
    start_positions = [
        (base_lat, base_lng),  # user1
        (base_lat + 0.0001, base_lng),  # user2
        (base_lat, base_lng + 0.0001),  # user3
        (base_lat + 0.0001, base_lng + 0.0001),  # user4
    ]

    ws_urls = [f"{WS_URL}/ws/room/{room_id}/?token={u.access_token}" for u in users]

    try:
        async with websockets.connect(ws_urls[0]) as ws1:
            async with websockets.connect(ws_urls[1]) as ws2:
                async with websockets.connect(ws_urls[2]) as ws3:
                    async with websockets.connect(ws_urls[3]) as ws4:
                        print("✅ 네 사용자 WebSocket 연결 성공")

                        # 연결 확인 메시지 수신 (비동기로 처리)
                        async def receive_initial_messages():
                            try:
                                await asyncio.wait_for(ws1.recv(), timeout=2)
                                await asyncio.wait_for(ws2.recv(), timeout=2)
                                await asyncio.wait_for(ws3.recv(), timeout=2)
                                await asyncio.wait_for(ws4.recv(), timeout=2)
                            except asyncio.TimeoutError:
                                pass

                        await receive_initial_messages()
                        print("   모든 사용자 연결 확인 완료")

                        # 모든 사용자가 동시에 GPS 이동 시작
                        print("\n🏃 GPS 이동 시작!")
                        tasks = [
                            simulate_user_movement(ws1, users[0], room_id, *start_positions[0]),
                            simulate_user_movement(ws2, users[1], room_id, *start_positions[1]),
                            simulate_user_movement(ws3, users[2], room_id, *start_positions[2]),
                            simulate_user_movement(ws4, users[3], room_id, *start_positions[3]),
                        ]
                        await asyncio.gather(*tasks)

                        print(f"\n✅ {GAME_DURATION_SECONDS}초 GPS 이동 완료!")

    except websockets.exceptions.ConnectionClosed as e:
        print(f"❌ WebSocket 연결 종료: {e}")
        return False
    except Exception as e:
        print(f"❌ WebSocket 에러: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 11. 게임 결과 확인
    print("\n📌 Step 11: 게임 종료 대기 및 결과 확인")
    # end_date까지 대기 + Celery 태스크 처리 시간
    wait_time = GAME_DURATION_SECONDS + 10  # 10초 여유
    print(f"   게임 종료 태스크 실행 대기 중... ({wait_time}초)")
    await asyncio.sleep(wait_time)
    
    response = requests.get(
        f"{BASE_URL}/api/rooms/{room_id}/", headers=user1.get_headers()
    )
    if response.status_code == 200:
        room_detail = response.json()
        print(f"   방 상태: {room_detail.get('status')}")
        print(f"   승리 팀: {room_detail.get('winner_team', 'N/A')}")
        print(f"   MVP: {room_detail.get('mvp', 'N/A')}")
        
        participants = room_detail.get("participants", [])
        print("\n   참가자 결과:")
        for p in participants:
            # ParticipantSerializer는 user 객체를 포함 (user.id, user.username)
            p_user = p.get("user") or {}
            p_user_id = str(p_user.get("id", ""))
            username = p_user.get("username")
            if not username:
                for u in users:
                    if str(u.user_id) == p_user_id:
                        username = u.username
                        break
            if not username:
                username = f"User({p_user_id[:8]}...)" if p_user_id else "Unknown"
            print(f"   - {username}:")
            print(f"     팀: {p.get('team')}")
            print(f"     점령한 땅: {p.get('hexes_claimed', 0)}개")
            print(f"     레이팅 변동: {p.get('rating_change', 0):+d}")
            print(f"     MVP: {'Yes' if p.get('is_mvp') else 'No'}")

    # 12. 최종 랭킹 확인 및 변화 분석
    print("\n📌 Step 12: 랭킹 변화 확인")
    await asyncio.sleep(3)  # 랭킹 업데이트 대기
    
    for user in users:
        user.get_final_ranking()
    
    print("\n📊 랭킹 변화 요약:")
    print("-" * 70)
    print(f"{'사용자':<20} {'초기':<15} {'최종':<15} {'변화':<10}")
    print("-" * 70)
    for user in users:
        rating_change = (user.final_rating or 0) - (user.initial_rating or 0)
        rank_change = (user.initial_rank or 0) - (user.final_rank or 0)  # 음수면 순위 상승
        print(
            f"{user.username:<20} "
            f"{user.initial_rank}위/{user.initial_rating:<6.0f} "
            f"{user.final_rank}위/{user.final_rating:<6.0f} "
            f"{rating_change:+.0f}점 ({rank_change:+d}위)"
        )
    print("-" * 70)

    # 13. 기록 목록 확인
    print("\n📌 Step 13: 기록 목록 확인")
    for user in users:
        response = requests.get(
            f"{BASE_URL}/api/records/", headers=user.get_headers()
        )
        if response.status_code == 200:
            records = response.json()
            if records:
                latest = records[0] if isinstance(records, list) else records.get("results", [])[0] if isinstance(records, dict) else None
                if latest:
                    print(f"   {user.username} 최신 기록:")
                    distance = latest.get('distance_meters') or 0
                    duration = latest.get('duration_seconds') or 0
                    pace = latest.get('avg_pace_seconds_per_km')
                    print(f"     거리: {distance:.2f}m")
                    print(f"     시간: {duration}초")
                    if pace is not None:
                        print(f"     페이스: {pace:.1f}초/km")
                    else:
                        print(f"     페이스: N/A")

    print("\n" + "=" * 70)
    print("🎉 게임 시뮬레이션 테스트 완료!")
    print("=" * 70)
    return True


def main():
    """메인 함수"""
    print(
        """
╔══════════════════════════════════════════════════════════════╗
║       게임 시뮬레이션 테스트 (4명, 30초)                      ║
║                                                               ║
║  이 테스트는 네 명의 사용자가 30초 동안 GPS로 이동하며       ║
║  게임을 진행하고, 결과 및 랭킹 변화를 확인합니다.             ║
╚══════════════════════════════════════════════════════════════╝
    """
    )

    # 서버 연결 테스트
    print("📡 서버 연결 테스트...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            print("✅ 서버 연결 성공\n")
        else:
            print(f"⚠️ 서버 응답: {response.status_code}")
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        print("   서버가 실행 중인지 확인하세요.")
        return

    # 테스트 실행
    result = asyncio.run(test_game_simulation_30sec())

    if result:
        print("\n✅ 모든 테스트 통과!")
    else:
        print("\n❌ 테스트 실패")


if __name__ == "__main__":
    main()
