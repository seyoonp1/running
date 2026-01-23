"""
러닝 모델
"""
from datetime import datetime
from .user import db

class Run(db.Model):
    """러닝 기록 모델"""
    __tablename__ = 'runs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    # 러닝 정보
    distance = db.Column(db.Float, nullable=False, default=0.0)  # 미터 단위
    duration = db.Column(db.Integer, nullable=False, default=0)  # 초 단위
    average_pace = db.Column(db.Float)  # 분/km
    average_speed = db.Column(db.Float)  # km/h
    calories = db.Column(db.Integer, default=0)
    run_type = db.Column(db.String(20), default='outdoor')  # outdoor, indoor, treadmill
    
    # 시간 정보
    started_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    finished_at = db.Column(db.DateTime)
    
    # 메타데이터
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    locations = db.relationship('RunLocation', backref='run', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """사전 형태로 변환"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'distance': self.distance,
            'duration': self.duration,
            'average_pace': self.average_pace,
            'average_speed': self.average_speed,
            'calories': self.calories,
            'run_type': self.run_type,
            'started_at': self.started_at.isoformat(),
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
            'notes': self.notes,
            'locations_count': len(self.locations),
        }

class RunLocation(db.Model):
    """러닝 경로 위치 모델"""
    __tablename__ = 'run_locations'
    
    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('runs.id'), nullable=False, index=True)
    
    # 위치 정보
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    altitude = db.Column(db.Float)
    accuracy = db.Column(db.Float)
    speed = db.Column(db.Float)  # m/s
    
    # 시간 정보
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """사전 형태로 변환"""
        return {
            'id': self.id,
            'run_id': self.run_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'altitude': self.altitude,
            'accuracy': self.accuracy,
            'speed': self.speed,
            'timestamp': self.timestamp.isoformat(),
        }
