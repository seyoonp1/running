"""
인증 라우트
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.user import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """회원가입"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': '필수 필드가 누락되었습니다.'}), 400
    
    # 중복 확인
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': '이미 사용 중인 사용자명입니다.'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': '이미 사용 중인 이메일입니다.'}), 400
    
    # 사용자 생성
    user = User(
        username=data['username'],
        email=data['email']
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': '회원가입이 완료되었습니다.',
        'user': user.to_dict(),
        'access_token': access_token
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """로그인"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': '사용자명과 비밀번호를 입력해주세요.'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': '잘못된 사용자명 또는 비밀번호입니다.'}), 401
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': '로그인 성공',
        'user': user.to_dict(),
        'access_token': access_token
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """현재 사용자 정보"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404
    
    return jsonify({'user': user.to_dict()}), 200
