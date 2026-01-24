"""
Development settings
"""
from .base import *

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# Database (can use SQLite for local dev)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'hexgame_dev'),
        'USER': os.environ.get('DB_USER', 'hexgame'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'hexgame'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# CORS for development
CORS_ALLOW_ALL_ORIGINS = True

