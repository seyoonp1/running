"""
Production settings
"""
import os
from .base import *
# import boto3  # Uncomment if using AWS SSM

DEBUG = False

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Database (RDS)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# AWS SSM Parameter Store for secrets (optional)
# ssm = boto3.client('ssm', region_name=os.environ.get('AWS_REGION'))
# SECRET_KEY = ssm.get_parameter(Name='/hexgame/prod/secret-key', WithDecryption=True)['Parameter']['Value']

# Logging to CloudWatch
LOGGING['handlers']['cloudwatch'] = {
    'class': 'watchtower.CloudWatchLogHandler',
    'formatter': 'json',
    'log_group': '/aws/hexgame/prod',
    'stream_name': 'django',
}

LOGGING['root']['handlers'].append('cloudwatch')

