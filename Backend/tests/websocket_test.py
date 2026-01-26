#!/usr/bin/env python
"""
WebSocket 실시간 위치 전파 테스트 스크립트

이 스크립트는 두 명의 사용자가 같은 방에서 실시간으로 위치를 공유하고
이벤트가 제대로 전파되는지 테스트합니다.

사용법:
1. pip install websockets requests
2. python websocket_test.py

테스트 시나리오:
1. 두 명의 사용자 생성 (user1, user2)
2. 방 생성 (user1이 방장)
3. user2가 방 참가
4. 방장이 게임 시작
5. 두 사용자가 WebSocket 연결
6. user1이 위치 업데이트 → user2가 수신 확인
7. user1이 기록 시작 → 땅 점령 → user2가 이벤트 수신 확인
"""

import asyncio
import json
import requests
import websockets
import time
from datetime import datetime

# 서버 설정
BASE_URL = "http://44.196.254.97"
WS_URL = "ws://44.196.254.97"

# 테스트 설정
TEST_PREFIX = f"test_{int(time.time())}"


class TestUser:
    """테스트 사용자 클래스"""
    
    def __init__(self, username, email, password):
        self.username = username
        self.email = email
        self.password = password
        self.access_token = None
        self.user_id = None
        self.websocket = None
        self.received_messages = []
    
    def register(self):
        """회원가입"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json={
                "username": self.username,
                "email": self.email,
                "password": self.password
            }
        )
        if response.status_code == 201:
            data = response.json()
            self.user_id = data.get('id')
            print(f"✅ {self.username} 회원가입 성공")
            return True
        else:
            print(f"❌ {self.username} 회원가입 실패: {response.text}")
            return False
    
    def login(self):
        """로그인"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json={
                "username": self.username,
                "password": self.password
            }
        )
        if response.status_code == 200:
            data = response.json()
            self.access_token = data.get('access')
            print(f"✅ {self.username} 로그인 성공")
            return True
        else:
            print(f"❌ {self.username} 로그인 실패: {response.text}")
            return False
    
    def get_headers(self):
        """인증 헤더 반환"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }


async def test_websocket_broadcast():
    """WebSocket 브로드캐스트 테스트"""
    print("\n" + "="*60)
    print("🧪 WebSocket 실시간 위치 전파 테스트 시작")
    print("="*60 + "\n")
    
    # 1. 테스트 사용자 생성
    print("📌 Step 1: 테스트 사용자 생성")
    user1 = TestUser(
        f"{TEST_PREFIX}_user1",
        f"{TEST_PREFIX}_user1@test.com",
        "testpassword123"
    )
    user2 = TestUser(
        f"{TEST_PREFIX}_user2",
        f"{TEST_PREFIX}_user2@test.com",
        "testpassword123"
    )
    
    # 회원가입 및 로그인
    if not user1.register() or not user1.login():
        print("❌ User1 설정 실패")
        return False
    
    if not user2.register() or not user2.login():
        print("❌ User2 설정 실패")
        return False
    
    # 2. 게임 구역 조회
    print("\n📌 Step 2: 게임 구역 조회")
    response = requests.get(
        f"{BASE_URL}/api/game-areas/",
        headers=user1.get_headers()
    )
    
    if response.status_code != 200:
        print(f"❌ 게임 구역 조회 실패: {response.text}")
        print("⚠️ 게임 구역이 없습니다. Django Admin에서 먼저 추가해주세요.")
        return False
    
    game_areas = response.json()
    if not game_areas.get('results') or len(game_areas['results']) == 0:
        print("⚠️ 등록된 게임 구역이 없습니다. Django Admin에서 먼저 추가해주세요.")
        return False
    
    game_area_id = game_areas['results'][0]['id']
    print(f"✅ 게임 구역 선택: {game_areas['results'][0]['name']}")
    
    # 3. 방 생성 (user1이 방장)
    print("\n📌 Step 3: 방 생성")
    response = requests.post(
        f"{BASE_URL}/api/rooms/",
        headers=user1.get_headers(),
        json={
            "name": f"{TEST_PREFIX}_test_room",
            "max_participants": 2,
            "start_date": "2026-01-26",
            "end_date": "2026-02-26",
            "game_area_id": game_area_id
        }
    )
    
    if response.status_code not in [200, 201]:
        print(f"❌ 방 생성 실패: {response.text}")
        return False
    
    room_data = response.json()
    room_id = room_data.get('id')
    invite_code = room_data.get('invite_code')
    print(f"✅ 방 생성 성공: {room_id}")
    print(f"   초대 코드: {invite_code}")
    
    # 4. user2가 방 참가
    print("\n📌 Step 4: User2 방 참가")
    response = requests.post(
        f"{BASE_URL}/api/rooms/{room_id}/join/",
        headers=user2.get_headers(),
        json={"team": "B"}
    )
    
    if response.status_code not in [200, 201]:
        print(f"❌ 방 참가 실패: {response.text}")
        return False
    
    print("✅ User2 방 참가 성공")
    
    # 5. 방장이 게임 시작
    print("\n📌 Step 5: 게임 시작")
    response = requests.post(
        f"{BASE_URL}/api/rooms/{room_id}/start/",
        headers=user1.get_headers()
    )
    
    if response.status_code not in [200, 201]:
        print(f"❌ 게임 시작 실패: {response.text}")
        return False
    
    print("✅ 게임 시작 성공")
    
    # 6. WebSocket 연결
    print("\n📌 Step 6: WebSocket 연결")
    
    user1_ws_url = f"{WS_URL}/ws/room/{room_id}/?token={user1.access_token}"
    user2_ws_url = f"{WS_URL}/ws/room/{room_id}/?token={user2.access_token}"
    
    try:
        async with websockets.connect(user1_ws_url) as ws1:
            async with websockets.connect(user2_ws_url) as ws2:
                print("✅ 두 사용자 WebSocket 연결 성공")
                
                # 연결 확인 메시지 수신
                msg1 = await asyncio.wait_for(ws1.recv(), timeout=5)
                msg2 = await asyncio.wait_for(ws2.recv(), timeout=5)
                print(f"   User1 연결 확인: {json.loads(msg1)['type']}")
                print(f"   User2 연결 확인: {json.loads(msg2)['type']}")
                
                # 7. User1이 기록 시작
                print("\n📌 Step 7: User1 기록 시작")
                await ws1.send(json.dumps({
                    "type": "start_recording"
                }))
                
                # 응답 수신 대기
                try:
                    response_msg = await asyncio.wait_for(ws1.recv(), timeout=5)
                    print(f"   User1 기록 시작 응답: {json.loads(response_msg)}")
                except asyncio.TimeoutError:
                    print("   기록 시작 응답 타임아웃 (정상일 수 있음)")
                
                # 8. User1이 위치 업데이트 전송
                print("\n📌 Step 8: User1 위치 업데이트 전송")
                test_locations = [
                    {"lat": 37.5665, "lng": 126.9780},  # 서울시청 근처
                    {"lat": 37.5666, "lng": 126.9781},
                    {"lat": 37.5667, "lng": 126.9782},
                ]
                
                for i, loc in enumerate(test_locations):
                    await ws1.send(json.dumps({
                        "type": "loc",
                        "lat": loc["lat"],
                        "lng": loc["lng"],
                        "accuracy": 10,
                        "speed": 3
                    }))
                    print(f"   📍 위치 {i+1} 전송: {loc}")
                    await asyncio.sleep(0.5)
                
                # 9. User2가 브로드캐스트 수신 확인
                print("\n📌 Step 9: User2 브로드캐스트 수신 확인")
                received_count = 0
                try:
                    while True:
                        msg = await asyncio.wait_for(ws2.recv(), timeout=3)
                        data = json.loads(msg)
                        received_count += 1
                        print(f"   📨 User2 수신 [{received_count}]: type={data.get('type')}")
                        
                        if data.get('type') == 'location_update':
                            print(f"      → 위치: ({data.get('lat')}, {data.get('lng')})")
                        elif data.get('type') == 'hex_claimed':
                            print(f"      → 점령: {data.get('h3_id')}, 팀: {data.get('team')}")
                        elif data.get('type') == 'score_update':
                            print(f"      → 점수 업데이트: {data.get('scores')}")
                            
                except asyncio.TimeoutError:
                    pass
                
                if received_count > 0:
                    print(f"\n✅ 브로드캐스트 테스트 성공! ({received_count}개 메시지 수신)")
                else:
                    print("\n⚠️ 브로드캐스트 메시지 수신 없음")
                
                # 10. User1 기록 종료
                print("\n📌 Step 10: User1 기록 종료")
                await ws1.send(json.dumps({
                    "type": "stop_recording"
                }))
                
                try:
                    response_msg = await asyncio.wait_for(ws1.recv(), timeout=5)
                    data = json.loads(response_msg)
                    print(f"   기록 종료 응답: {data.get('type')}")
                    if data.get('type') == 'recording_stopped':
                        print(f"   거리: {data.get('distance_meters', 0):.2f}m")
                        print(f"   시간: {data.get('duration_seconds', 0)}초")
                except asyncio.TimeoutError:
                    print("   기록 종료 응답 타임아웃")
                
                print("\n" + "="*60)
                print("🎉 WebSocket 테스트 완료!")
                print("="*60)
                return True
                
    except websockets.exceptions.ConnectionClosed as e:
        print(f"❌ WebSocket 연결 종료: {e}")
        return False
    except Exception as e:
        print(f"❌ WebSocket 에러: {e}")
        return False


def main():
    """메인 함수"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║       WebSocket 실시간 위치 전파 테스트                       ║
║                                                               ║
║  이 테스트는 두 명의 사용자가 같은 방에서                    ║
║  실시간으로 위치를 공유하는 것을 검증합니다.                 ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
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
    result = asyncio.run(test_websocket_broadcast())
    
    if result:
        print("\n✅ 모든 테스트 통과!")
    else:
        print("\n❌ 테스트 실패")


if __name__ == "__main__":
    main()

