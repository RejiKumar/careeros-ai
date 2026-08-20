"""Auth router: current-user and account-deletion endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.auth import CurrentUser, get_current_user
from app.integrations.supabase.client import (
    SupabaseClients,
    get_supabase_clients,
    require_service_client,
)

from .migration import GuestMigrationService
from .schema import GuestMigrationRequest, GuestMigrationResponse, UserResponse
from .service import to_user_response

router = APIRouter(tags=["auth"])


@router.get("/auth/me", response_model=UserResponse)
def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> UserResponse:
    return to_user_response(user)


@router.delete("/auth/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    response: Response,
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    """Permanently delete the authenticated user's account and all owned data.

    Uses the service-role client so cascading deletes (resumes, chats,
    missions, usage, ...) run under the database foreign keys.
    """
    try:
        service_client = require_service_client(clients)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not available right now.",
        ) from exc
    service_client.auth.admin.delete_user(user.id)
    response.status_code = status.HTTP_204_NO_CONTENT


@router.post("/auth/migrate-guest", response_model=GuestMigrationResponse)
def migrate_guest(
    payload: GuestMigrationRequest,
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> GuestMigrationResponse:
    """Transfer guest-owned rows to the authenticated user (idempotent)."""
    return GuestMigrationService(clients).migrate(user, payload.guest_id)
