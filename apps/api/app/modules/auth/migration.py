"""Guest-to-account migration use case.

Transfers ownership of all guest-owned rows to the authenticated user,
idempotently: rows already owned by the user are left untouched and rows that
no longer exist are ignored. The guest identity is removed on success.
"""

from __future__ import annotations

import uuid

from fastapi import status

from app.core.auth import CurrentUser
from app.core.errors import AppError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)

from .schema import GuestMigrationResponse

_MIGRATABLE_TABLES = (
    "resumes",
    "job_descriptions",
    "coach_threads",
    "assessments",
    "job_matches",
    "roasts",
    "interview_sessions",
    "feedback",
)


class InvalidGuestIdError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="invalid_guest_id",
            message="Guest identity is invalid.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class GuestMigrationService:
    def __init__(self, clients: SupabaseClients) -> None:
        self._clients = clients
        self._client = require_service_client(clients)

    def migrate(self, user: CurrentUser, guest_id: str) -> GuestMigrationResponse:
        try:
            parsed = uuid.UUID(guest_id)
        except ValueError as exc:
            raise InvalidGuestIdError() from exc
        if str(parsed) != guest_id:
            raise InvalidGuestIdError()

        ensure_guest_account(self._clients, guest_id)

        total = 0
        for table in _MIGRATABLE_TABLES:
            result = (
                self._client.table(table)
                .update({"user_id": user.id, "guest_id": None})
                .eq("guest_id", guest_id)
                .execute()
            )
            total += len(result.data)

        self._client.table("guest_accounts").delete().eq("id", guest_id).execute()
        return GuestMigrationResponse(migrated_records=total, guest_id=guest_id)
