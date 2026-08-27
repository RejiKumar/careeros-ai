"""Application tracker use cases: track job applications and their progress.

Applications are untrusted user-entered records; stats are derived read-only
views over the user's own rows.
"""

from __future__ import annotations

from datetime import date

from fastapi import status

from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import ApplicationRepository
from .schema import (
    ApplicationResponse,
    ApplicationStatsResponse,
)


class ApplicationNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Application not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ApplicationService:
    def __init__(self, clients: SupabaseClients) -> None:
        service_client = require_service_client(clients)
        self._repository = ApplicationRepository(service_client)

    def create_application(
        self,
        actor: CurrentActor,
        *,
        job_id: str | None,
        job_title: str,
        company: str,
        status: str,
        notes: str | None,
        url: str | None,
        applied_at: str | None,
        interview_date: str | None,
        follow_up_date: str | None,
    ) -> ApplicationResponse:
        row = self._repository.create(
            actor=actor,
            job_id=job_id,
            job_title=job_title,
            company=company,
            status=status,
            notes=notes,
            url=url,
            applied_at=applied_at,
            interview_date=interview_date,
            follow_up_date=follow_up_date,
        )
        return _to_application_response(row)

    def get_application(self, actor: CurrentActor, *, application_id: str) -> ApplicationResponse:
        row = self._repository.get(actor=actor, application_id=application_id)
        if row is None:
            raise ApplicationNotFoundError()
        return _to_application_response(row)

    def list_applications(
        self, actor: CurrentActor, *, status_filter: str | None
    ) -> list[ApplicationResponse]:
        rows = self._repository.list_by_user(actor=actor, status_filter=status_filter)
        return [_to_application_response(row) for row in rows]

    def update_application(
        self,
        actor: CurrentActor,
        *,
        application_id: str,
        status: str | None,
        notes: str | None,
        interview_date: str | None,
        follow_up_date: str | None,
    ) -> ApplicationResponse:
        existing = self._repository.get(actor=actor, application_id=application_id)
        if existing is None:
            raise ApplicationNotFoundError()

        updated = self._repository.update(
            actor=actor,
            application_id=application_id,
            status=status,
            notes=notes,
            interview_date=interview_date,
            follow_up_date=follow_up_date,
        )
        if updated is None:
            raise ApplicationNotFoundError()
        return _to_application_response(updated)

    def delete_application(self, actor: CurrentActor, *, application_id: str) -> None:
        existing = self._repository.get(actor=actor, application_id=application_id)
        if existing is None:
            raise ApplicationNotFoundError()
        self._repository.delete(actor=actor, application_id=application_id)

    def get_stats(self, actor: CurrentActor) -> ApplicationStatsResponse:
        rows = self._repository.get_stats(actor=actor)
        return _compute_stats(rows)


def _to_application_response(row: dict) -> ApplicationResponse:
    return ApplicationResponse(
        id=row["id"],
        user_id=row.get("user_id"),
        job_id=row.get("job_id"),
        job_title=row["job_title"],
        company=row["company"],
        status=row["status"],
        notes=row.get("notes"),
        url=row.get("url"),
        applied_at=row.get("applied_at"),
        interview_date=row.get("interview_date"),
        follow_up_date=row.get("follow_up_date"),
        created_at=row["created_at"],
        updated_at=row.get("updated_at"),
    )


def _compute_stats(rows: list[dict]) -> ApplicationStatsResponse:
    total = len(rows)
    applied = interviewing = offered = rejected = 0
    for row in rows:
        status_value = row.get("status")
        if status_value == "applied":
            applied += 1
        elif status_value == "interviewing":
            interviewing += 1
        elif status_value == "offered":
            offered += 1
        elif status_value == "rejected":
            rejected += 1

    responded = interviewing + offered + rejected
    response_rate = (responded / total) if total else 0.0

    response_days: list[int] = []
    for row in rows:
        applied_at = row.get("applied_at")
        interview_date = row.get("interview_date")
        if applied_at and interview_date:
            try:
                delta = _parse_date(interview_date) - _parse_date(applied_at)
                if delta.days >= 0:
                    response_days.append(delta.days)
            except ValueError:
                continue
    avg_response_days = (sum(response_days) / len(response_days)) if response_days else None

    return ApplicationStatsResponse(
        total=total,
        applied=applied,
        interviewing=interviewing,
        offered=offered,
        rejected=rejected,
        response_rate=response_rate,
        avg_response_days=avg_response_days,
    )


def _parse_date(value: str) -> date:
    return date.fromisoformat(value[:10])
