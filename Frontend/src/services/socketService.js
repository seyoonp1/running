import { tokenService } from './api';

const WS_URL = __DEV__
    ? 'ws://localhost:8000/ws/room'
    : 'wss://your-production-api.com/ws/room';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = {};
        this.roomId = null;
    }

    // WebSocket 연결
    async connect(roomId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('이미 연결되어 있습니다.');
            return;
        }

        this.roomId = roomId;
        const token = await tokenService.getAccessToken();
        const url = `${WS_URL}/${roomId}/?token=${token}`;

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            console.log('WebSocket Connected');
            this.emit('connected');
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket Message:', data);
                this.emit(data.type, data);
            } catch (e) {
                console.error('메시지 파싱 에러:', e);
            }
        };

        this.socket.onclose = (event) => {
            console.log('WebSocket Closed:', event.code, event.reason);
            this.emit('disconnected');
            this.socket = null;
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.emit('error', error);
        };
    }

    // 연결 종료
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.roomId = null;
        }
    }

    // 메시지 전송
    send(type, payload = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket이 연결되지 않았습니다.');
            return;
        }

        const message = JSON.stringify({
            type,
            ...payload,
        });
        this.socket.send(message);
    }

    // 위치 업데이트 전송
    sendLocationUpdate(lat, lng) {
        this.send('location_update', { lat, lng });
    }

    // 페인트볼 사용
    usePaintball(targetH3Id, type = 'normal') {
        this.send('paintball', {
            target_h3_id: targetH3Id,
            paintball_type: type
        });
    }

    // 페인트볼 교환
    exchangePaintball() {
        this.send('exchange_paintball');
    }

    // 이벤트 리스너 등록
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    // 이벤트 리스너 제거
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    // 이벤트 발생
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => callback(data));
    }
}

const socketService = new SocketService();
export default socketService;
