"""Supabase access-token verification.

Server-side verification of the JWT the mobile app sends. We never parse or
trust a JWT by signature ourselves: we ask Supabase to resolve the user, which
also covers expired/revoked tokens.
"""

from __future__ import annotations

from typing import Any

from supabase import Client

ERROR_CODE_EXPIRED = "token_expired"
ERROR_CODE_INVALID = "invalid_token"
ERROR_CODE_MISSING = "missing_token"


class AuthVerificationError(Exception):
    """Raised when an access token cannot be resolved to a user."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def verify_access_token(client: Client, access_token: str) -> dict[str, Any]:
    if not access_token:
        raise AuthVerificationError(ERROR_CODE_MISSING, "Missing access token.")
    try:
        response = client.auth.get_user(access_token)
    except Exception as exc:  # supabase-auth raises provider-specific errors
        message = str(exc)
        if "expired" in message.lower() or "exp" in message.lower():
            raise AuthVerificationError(ERROR_CODE_EXPIRED, "Access token has expired.") from exc
        raise AuthVerificationError(ERROR_CODE_INVALID, "Access token is invalid.") from exc

    user = getattr(response, "user", None)
    if user is None or not getattr(user, "id", None):
        raise AuthVerificationError(ERROR_CODE_INVALID, "Access token is invalid.")

    return {
        "sub": str(user.id),
        "email": getattr(user, "email", None),
        "role": getattr(user, "role", None),
        "phone": getattr(user, "phone", None),
    }
