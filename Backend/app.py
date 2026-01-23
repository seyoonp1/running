"""
Backend 애플리케이션 진입점
"""
import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from config import config
from models.user import db

def create_app(config_name=None):
    """애플리케이션 팩토리"""
    app = Flask(__name__)
    
    # 설정 로드
    config_name = config_name or os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(config[config_name])
    
    # 확장 초기화
    db.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])
    JWTManager(app)
    Migrate(app, db)
    
    # 데이터베이스 초기화
    with app.app_context():
        db.create_all()
    
    # 라우트 등록
    from routes.auth import auth_bp
    from routes.runs import runs_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(runs_bp, url_prefix='/api/runs')
    
    @app.route('/')
    def hello():
        return {'message': 'Running App API', 'version': '1.0.0'}
    
    @app.route('/api/health')
    def health():
        return {'status': 'healthy'}
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
