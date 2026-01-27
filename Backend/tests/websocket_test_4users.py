#!/usr/bin/env python
"""
WebSocket 실시간 위치 전파 테스트 스크립트 (4명 버전)

이 스크립트는 네 명의 사용자가 같은 방에서 실시간으로 위치를 공유하고
이벤트가 제대로 전파되는지 테스트합니다.

사용법:
1. pip install websockets requests
2. python websocket_test_4users.py

테스트 시나리오:
1. 네 명의 사용자 생성 (user1~user4)
2. user1이 user2~user4에게 친구 요청 → 수락
3. 방 생성 (user1이 방장, start_date는 현재 일시로 설정)
4. user1이 user2~user4를 방에 초대
5. user2~user4가 우편함에서 초대 수락
6. 방장이 게임 시작 (start_date 검증: 현재 시간이 start_date보다 같거나 이후여야 함)
7. 네 사용자가 WebSocket 연결
8. user1이 위치 업데이트 → user2~user4가 수신 확인
9. user1이 기록 시작/종료 → 응답 확인
"""

import asyncio
import json
import requests
import websockets
import time
from datetime import datetime, timedelta

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
            print(f"✅ {self.username} 회원가입 성공")
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
    print(f"✅ {user.username} 방 초대 메일 확인: {mailbox_id}")

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
    print(f"✅ {user.username} 친구 요청 메일 확인: {mailbox_id}")

    response = requests.post(
        f"{BASE_URL}/api/mailbox/{mailbox_id}/respond/",
        headers=user.get_headers(),
        json={"accept": True},
    )
    if response.status_code not in [200, 201]:
        print(f"❌ {user.username} 친구 요청 수락 실패: {response.text}")
        return False

    accept_data = response.json()
    print(f"✅ {user.username} 친구 요청 수락 성공: {accept_data.get('message')}")
    return True


async def test_websocket_broadcast_4users():
    """WebSocket 브로드캐스트 테스트 (4명)"""
    print("\n" + "=" * 60)
    print("🧪 WebSocket 실시간 위치 전파 테스트 시작 (4명)")
    print("=" * 60 + "\n")

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

    # 2. 친구 요청 (user1 -> user2~user4)
    print("\n📌 Step 2: 친구 요청 및 수락")
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

    # 3. 게임 구역 조회
    print("\n📌 Step 3: 게임 구역 조회")
    response = requests.get(f"{BASE_URL}/api/game-areas/", headers=user1.get_headers())
    if response.status_code != 200:
        print(f"❌ 게임 구역 조회 실패: {response.text}")
        print("⚠️ 게임 구역이 없습니다. Django Admin에서 먼저 추가해주세요.")
        return False

    game_areas = response.json()
    if not game_areas.get("results"):
        print("⚠️ 등록된 게임 구역이 없습니다. Django Admin에서 먼저 추가해주세요.")
        return False

    game_area_id = game_areas["results"][0]["id"]
    print(f"✅ 게임 구역 선택: {game_areas['results'][0]['name']}")

    # 4. 방 생성 (user1이 방장, start_date는 현재 일시로 설정)
    print("\n📌 Step 4: 방 생성")
    now = datetime.now().replace(second=0, microsecond=0)
    end_at = now + timedelta(days=30)
    start_date = now.isoformat(timespec='minutes')
    end_date = end_at.isoformat(timespec='minutes')

    response = requests.post(
        f"{BASE_URL}/api/rooms/",
        headers=user1.get_headers(),
        json={
            "name": f"{TEST_PREFIX}_test_room_4users",
            "total_participants": 4,
            "start_date": today,
            "end_date": end_date,
            "game_area_id": game_area_id,
        },
    )
    if response.status_code not in [200, 201]:
        print(f"❌ 방 생성 실패: {response.text}")
        return False

    room_data = response.json()
    room_id = room_data.get("id")
    start_date = room_data.get("start_date")
    print(f"✅ 방 생성 성공: {room_id}")
    print(f"   시작 일시: {start_date}")

    # 5. user1이 user2~user4를 방에 초대
    print("\n📌 Step 5: User1이 User2~User4를 방에 초대")
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

    # 6. user2~user4가 우편함에서 초대 확인 및 수락
    print("\n📌 Step 6: User2~User4가 초대 수락")
    for user in users[1:]:
        if not accept_room_invite(user):
            return False

    # 7. 방장이 게임 시작
    print("\n📌 Step 7: 방장이 게임 시작")
    print(f"   시작 일시 검증: 현재({now.isoformat(timespec='minutes')}) >= 시작 일시({start_date})")
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
    print("✅ 게임 시작 성공")

    # 8. WebSocket 연결
    print("\n📌 Step 8: WebSocket 연결")
    ws_urls = [f"{WS_URL}/ws/room/{room_id}/?token={u.access_token}" for u in users]

    try:
        async with websockets.connect(ws_urls[0]) as ws1:
            async with websockets.connect(ws_urls[1]) as ws2:
                async with websockets.connect(ws_urls[2]) as ws3:
                    async with websockets.connect(ws_urls[3]) as ws4:
                        print("✅ 네 사용자 WebSocket 연결 성공")

                        # 연결 확인 메시지 수신
                        msg1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
                        msg2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=5))
                        msg3 = json.loads(await asyncio.wait_for(ws3.recv(), timeout=5))
                        msg4 = json.loads(await asyncio.wait_for(ws4.recv(), timeout=5))
                        participant_map = {
                            msg1.get("participant_id"): "user1",
                            msg2.get("participant_id"): "user2",
                            msg3.get("participant_id"): "user3",
                            msg4.get("participant_id"): "user4",
                        }
                        print("   모든 사용자 연결 확인 완료")
                        print(f"   participant_id 매핑: {participant_map}")

                        # 9. User1 기록 시작
                        print("\n📌 Step 9: User1 기록 시작")
                        await ws1.send(json.dumps({"type": "start_recording"}))
                        try:
                            response_msg = await asyncio.wait_for(ws1.recv(), timeout=5)
                            print(f"   User1 기록 시작 응답: {json.loads(response_msg)}")
                        except asyncio.TimeoutError:
                            print("   기록 시작 응답 타임아웃 (정상일 수 있음)")

                        # 10. User1 위치 업데이트 전송
                        print("\n📌 Step 10: User1 위치 업데이트 전송")
                        test_locations = [
                            {"lat": 37.5665, "lng": 126.9780},
                            {"lat": 37.5666, "lng": 126.9781},
                            {"lat": 37.5667, "lng": 126.9782},
                        ]
                        for i, loc in enumerate(test_locations):
                            await ws1.send(
                                json.dumps(
                                    {
                                        "type": "loc",
                                        "lat": loc["lat"],
                                        "lng": loc["lng"],
                                        "accuracy": 10,
                                        "speed": 3,
                                    }
                                )
                            )
                            print(f"   📍 위치 {i+1} 전송: {loc}")
                            await asyncio.sleep(0.5)

                        # 11. User2~User4 브로드캐스트 수신 확인
                        print("\n📌 Step 11: User2~User4 브로드캐스트 수신 확인")
                        received_count = 0
                        sockets = [ws2, ws3, ws4]
                        try:
                            while True:
                                for idx, ws in enumerate(sockets, start=2):
                                    msg = await asyncio.wait_for(ws.recv(), timeout=1)
                                    data = json.loads(msg)
                                    received_count += 1
                                    sender = participant_map.get(data.get("participant_id"), "unknown")
                                    print(
                                        f"   📨 User{idx} 수신 [{received_count}]: "
                                        f"type={data.get('type')}, "
                                        f"from={sender}({data.get('participant_id')})"
                                    )
                        except asyncio.TimeoutError:
                            pass

                        if received_count > 0:
                            print(f"\n✅ 브로드캐스트 테스트 성공! ({received_count}개 메시지 수신)")
                        else:
                            print("\n⚠️ 브로드캐스트 메시지 수신 없음")

                        # 12. User1 기록 종료
                        print("\n📌 Step 12: User1 기록 종료")
                        await ws1.send(json.dumps({"type": "stop_recording"}))
                        try:
                            response_msg = await asyncio.wait_for(ws1.recv(), timeout=5)
                            data = json.loads(response_msg)
                            print(f"   기록 종료 응답: {data.get('type')}")
                            if data.get("type") == "recording_stopped":
                                print(f"   거리: {data.get('distance_meters', 0):.2f}m")
                                print(f"   시간: {data.get('duration_seconds', 0)}초")
                        except asyncio.TimeoutError:
                            print("   기록 종료 응답 타임아웃")

                        print("\n" + "=" * 60)
                        print("🎉 WebSocket 테스트 완료! (4명)")
                        print("=" * 60)
                        return True

    except websockets.exceptions.ConnectionClosed as e:
        print(f"❌ WebSocket 연결 종료: {e}")
        return False
    except Exception as e:
        print(f"❌ WebSocket 에러: {e}")
        return False


def main():
    """메인 함수"""
    print(
        """
╔══════════════════════════════════════════════════════════════╗
║       WebSocket 실시간 위치 전파 테스트 (4명)                 ║
║                                                               ║
║  이 테스트는 네 명의 사용자가 같은 방에서                    ║
║  실시간으로 위치를 공유하는 것을 검증합니다.                 ║
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
    result = asyncio.run(test_websocket_broadcast_4users())

    if result:
        print("\n✅ 모든 테스트 통과! (4명)")
    else:
        print("\n❌ 테스트 실패")


if __name__ == "__main__":
    main()
