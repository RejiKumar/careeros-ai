"""Current-user use case."""

from __future__ import annotations

from app.core.auth import CurrentUser

from .schema import UserResponse


def to_user_response(user: CurrentUser) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, role=user.role)
