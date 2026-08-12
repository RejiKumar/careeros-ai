"""Auth router."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import CurrentUser, get_current_user

from .schema import UserResponse
from .service import to_user_response

router = APIRouter(tags=["auth"])


@router.get("/auth/me", response_model=UserResponse)
def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> UserResponse:
    return to_user_response(user)
