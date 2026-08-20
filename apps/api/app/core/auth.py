"""FastAPI auth primitives: typed current user/actor and dependencies."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import Depends, Header, status
from pydantic import BaseModel

from app.core.errors import AppError
from app.integrations.supabase.auth import AuthVerificationError
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


class CurrentActor(BaseModel):
    """An authenticated user or a validated guest identity."""

    id: str
    kind: Literal["user", "guest"]
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


def get_current_actor(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    x_guest_id: Annotated[str | None, Header(alias="X-Guest-Id")] = None,
) -> CurrentActor:
    """Resolve an authenticated user or a guest identity (client-generated UUIDv4).

    Guests are only accepted when no bearer token is present; authenticated
    requests always take the user path.
    """
    if authorization:
        user = get_current_user(clients, authorization)
        return CurrentActor(id=user.id, kind="user", email=user.email, role=user.role)

    if x_guest_id:
        guest_id = x_guest_id.strip()
        try:
            parsed = uuid.UUID(guest_id)
        except ValueError as exc:
            raise UnauthenticatedError("invalid_guest_id", "Guest identity is invalid.") from exc
        if str(parsed) != guest_id:
            raise UnauthenticatedError("invalid_guest_id", "Guest identity is invalid.")
        return CurrentActor(id=guest_id, kind="guest")

    raise UnauthenticatedError("missing_identity", "Sign in or continue as a guest.")
