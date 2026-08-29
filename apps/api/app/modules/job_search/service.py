"""Job search use cases: search across platforms, save jobs and manage alerts.

Search results are untrusted external data; they are never treated as ground
truth. Saved jobs and alert preferences are owned by the actor.
"""

from __future__ import annotations

import uuid

from fastapi import status

from app.ai.provider import CareerAiProvider
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)

from .repository import JobSearchRepository
from .schema import (
    JobAlertPreference,
    JobSearchResponse,
    JobSearchResult,
    SavedJobResponse,
)


class SearchProviderError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="search_provider_error",
            message="Job search could not be completed right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class SavedJobNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Saved job not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class DuplicateSavedJobError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="duplicate_saved_job",
            message="This job is already saved.",
            status_code=status.HTTP_409_CONFLICT,
        )


class JobSearchService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._clients = clients
        self._provider = provider
        self._repository = JobSearchRepository(service_client)

    def search_jobs(
        self,
        actor: CurrentActor,
        *,
        query: str,
        location: str | None = None,
        source: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> JobSearchResponse:
        results = _mock_search_results(query, location, source, page, limit)
        total = len(results)
        has_more = total == limit
        return JobSearchResponse(
            results=results,
            total=total,
            page=page,
            has_more=has_more,
        )

    def save_job(
        self,
        actor: CurrentActor,
        *,
        job_id: str,
        job_title: str,
        company: str,
        source: str,
        url: str,
        match_score: float | None = None,
    ) -> SavedJobResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)
        existing = self._repository.list_saved_jobs(actor=actor)
        for saved in existing:
            if saved["job_id"] == job_id:
                raise DuplicateSavedJobError()
        row = self._repository.save_job(
            actor=actor,
            job_id=job_id,
            job_title=job_title,
            company=company,
            source=source,
            url=url,
            match_score=match_score,
        )
        return _to_saved_job_response(row)

    def list_saved_jobs(self, actor: CurrentActor) -> list[SavedJobResponse]:
        rows = self._repository.list_saved_jobs(actor=actor)
        return [_to_saved_job_response(row) for row in rows]

    def delete_saved_job(self, actor: CurrentActor, *, job_id: str) -> None:
        existing = self._repository.list_saved_jobs(actor=actor)
        if not any(saved["job_id"] == job_id for saved in existing):
            raise SavedJobNotFoundError()
        self._repository.delete_saved_job(actor=actor, job_id=job_id)

    def update_alert_preference(
        self,
        actor: CurrentActor,
        *,
        query: str,
        location: str | None = None,
        min_match_score: float = 0.0,
        frequency: str = "daily",
        enabled: bool = True,
    ) -> JobAlertPreference:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)
        row = self._repository.upsert_alert_preference(
            actor=actor,
            query_text=query,
            location=location,
            min_match_score=min_match_score,
            frequency=frequency,
            enabled=enabled,
        )
        return _to_alert_preference(row)

    def get_alert_preference(self, actor: CurrentActor) -> JobAlertPreference | None:
        row = self._repository.get_alert_preference(actor=actor)
        if row is None:
            return None
        return _to_alert_preference(row)

    def delete_alert_preference(self, actor: CurrentActor) -> None:
        self._repository.delete_alert_preference(actor=actor)


def _to_saved_job_response(row: dict) -> SavedJobResponse:
    return SavedJobResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id") or "",
        job_id=row["job_id"],
        job_title=row["job_title"],
        company=row["company"],
        source=row["source"],
        url=row["url"],
        saved_at=row["saved_at"],
        match_score=row.get("match_score"),
    )


def _to_alert_preference(row: dict) -> JobAlertPreference:
    return JobAlertPreference(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id") or "",
        query=row["query"],
        location=row.get("location"),
        min_match_score=row["min_match_score"],
        frequency=row["frequency"],
        enabled=row["enabled"],
        created_at=row["created_at"],
    )


def _mock_search_results(
    query: str,
    location: str | None,
    source: str | None,
    page: int,
    limit: int,
) -> list[JobSearchResult]:
    """Return sample search results. Replace with real scrapers later."""
    mock_source = source if source and source != "all" else "linkedin"
    return [
        JobSearchResult(
            id=str(uuid.uuid4()),
            title=f"Senior {query.title()} Engineer",
            company="Acme Corp",
            location=location or "Remote",
            source=mock_source,
            url=f"https://example.com/jobs/{i}",
            description=f"We are looking for a {query} professional to join our team.",
            skills=[query, "problem solving", "communication"],
            posted_date="2026-08-20",
            salary_range="$80,000 - $120,000",
            match_score=None,
        )
        for i in range(min(limit, 5))
    ]
