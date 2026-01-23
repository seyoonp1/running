"""
러닝 라우트
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.user import db
from models.run import Run, RunLocation

runs_bp = Blueprint('runs', __name__)

@runs_bp.route('', methods=['GET'])
@jwt_required()
def get_runs():
    """러닝 기록 목록 조회"""
    user_id = get_jwt_identity()
    
    # 페이지네이션
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    runs = Run.query.filter_by(user_id=user_id)\
        .order_by(Run.started_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'runs': [run.to_dict() for run in runs.items],
        'total': runs.total,
        'page': page,
        'per_page': per_page,
        'pages': runs.pages
    }), 200

@runs_bp.route('', methods=['POST'])
@jwt_required()
def create_run():
    """러닝 기록 생성"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': '데이터가 필요합니다.'}), 400
    
    run = Run(
        user_id=user_id,
        distance=data.get('distance', 0),
        duration=data.get('duration', 0),
        average_pace=data.get('average_pace'),
        average_speed=data.get('average_speed'),
        calories=data.get('calories', 0),
        run_type=data.get('run_type', 'outdoor'),
        started_at=datetime.fromisoformat(data['started_at']) if data.get('started_at') else datetime.utcnow(),
        finished_at=datetime.fromisoformat(data['finished_at']) if data.get('finished_at') else None,
        notes=data.get('notes')
    )
    
    db.session.add(run)
    db.session.flush()  # run.id를 얻기 위해
    
    # 위치 데이터 추가
    if data.get('locations'):
        for loc_data in data['locations']:
            location = RunLocation(
                run_id=run.id,
                latitude=loc_data['latitude'],
                longitude=loc_data['longitude'],
                altitude=loc_data.get('altitude'),
                accuracy=loc_data.get('accuracy'),
                speed=loc_data.get('speed'),
                timestamp=datetime.fromisoformat(loc_data['timestamp']) if loc_data.get('timestamp') else datetime.utcnow()
            )
            db.session.add(location)
    
    db.session.commit()
    
    return jsonify({
        'message': '러닝 기록이 저장되었습니다.',
        'run': run.to_dict()
    }), 201

@runs_bp.route('/<int:run_id>', methods=['GET'])
@jwt_required()
def get_run(run_id):
    """러닝 기록 상세 조회"""
    user_id = get_jwt_identity()
    
    run = Run.query.filter_by(id=run_id, user_id=user_id).first()
    
    if not run:
        return jsonify({'error': '러닝 기록을 찾을 수 없습니다.'}), 404
    
    run_dict = run.to_dict()
    run_dict['locations'] = [loc.to_dict() for loc in run.locations]
    
    return jsonify({'run': run_dict}), 200

@runs_bp.route('/<int:run_id>', methods=['DELETE'])
@jwt_required()
def delete_run(run_id):
    """러닝 기록 삭제"""
    user_id = get_jwt_identity()
    
    run = Run.query.filter_by(id=run_id, user_id=user_id).first()
    
    if not run:
        return jsonify({'error': '러닝 기록을 찾을 수 없습니다.'}), 404
    
    db.session.delete(run)
    db.session.commit()
    
    return jsonify({'message': '러닝 기록이 삭제되었습니다.'}), 200

@runs_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """러닝 통계 조회"""
    user_id = get_jwt_identity()
    
    runs = Run.query.filter_by(user_id=user_id).all()
    
    total_runs = len(runs)
    total_distance = sum(run.distance for run in runs)
    total_duration = sum(run.duration for run in runs)
    total_calories = sum(run.calories for run in runs)
    
    avg_distance = total_distance / total_runs if total_runs > 0 else 0
    avg_pace = sum(run.average_pace for run in runs if run.average_pace) / total_runs if total_runs > 0 else 0
    
    return jsonify({
        'total_runs': total_runs,
        'total_distance': total_distance,
        'total_duration': total_duration,
        'total_calories': total_calories,
        'average_distance': avg_distance,
        'average_pace': avg_pace
    }), 200
