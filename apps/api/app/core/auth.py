"""FastAPI auth primitives: typed current user and dependency."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, status
from pydantic import BaseModel

from app.core.errors import AppError
from app.integrations.supabase.auth import AuthVerificationError
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


class UnauthenticatedError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code=code, message=message, status_code=status.HTTP_401_UNAUTHORIZED)


def get_current_user(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> CurrentUser:
    if not authorization:
        raise UnauthenticatedError("missing_token", "Missing bearer token.")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = clients.verify_jwt(token)
    except AuthVerificationError as exc:
        raise UnauthenticatedError(exc.code, exc.message) from exc

    return CurrentUser(id=claims["sub"], email=claims.get("email"), role=claims.get("role"))
