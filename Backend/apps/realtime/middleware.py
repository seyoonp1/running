"""
JWT authentication middleware for Django Channels.
"""
import urllib.parse
import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from apps.accounts.models import User


@database_sync_to_async
def _get_user(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware:
    """Authenticate user from ?token=... query string."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope["user"] = await self._get_user_from_scope(scope)
        return await self.inner(scope, receive, send)

    async def _get_user_from_scope(self, scope):
        token = self._get_token_from_scope(scope)
        if not token:
            return AnonymousUser()

        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except jwt.PyJWTError:
            return AnonymousUser()

        user_id = payload.get("user_id")
        if not user_id:
            return AnonymousUser()

        return await _get_user(user_id)

    def _get_token_from_scope(self, scope):
        raw_query = scope.get("query_string", b"")
        if not raw_query:
            return None

        query = urllib.parse.parse_qs(raw_query.decode("utf-8"))
        token_list = query.get("token")
        if not token_list:
            return None

        return token_list[0]


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
