"""Company deep dive use cases: search, profile, jobs and saved companies.

Company data is aggregated from multiple sources. For now the service returns
mock/sample data; real aggregation will be wired up later.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import status

from app.ai.provider import CareerAiProvider
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)

from .repository import CompanyRepository
from .schema import (
    CompanyJob,
    CompanyJobsResponse,
    CompanyProfileResponse,
    SavedCompanyResponse,
)


class CompanyNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Company not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class SavedCompanyNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Saved company not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class CompanySearchError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="company_search_error",
            message="Company search could not be completed. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class CompanyService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._clients = clients
        self._provider = provider
        self._repository = CompanyRepository(service_client)

    def search_companies(
        self,
        actor: CurrentActor,
        *,
        query: str,
        location: str | None = None,
    ) -> list[CompanyProfileResponse]:
        rows = self._repository.search_companies(query=query, location=location)
        return [_to_profile_response(row) for row in rows]

    def get_company(
        self,
        actor: CurrentActor,
        *,
        company_id: str,
    ) -> CompanyProfileResponse:
        row = self._repository.get_company(company_id=company_id)
        if row is None:
            raise CompanyNotFoundError()
        return _to_profile_response(row)

    def get_company_jobs(
        self,
        actor: CurrentActor,
        *,
        company_id: str,
    ) -> CompanyJobsResponse:
        row = self._repository.get_company(company_id=company_id)
        if row is None:
            raise CompanyNotFoundError()

        company_name: str = row.get("name", "Unknown")
        sample_jobs = [
            CompanyJob(
                id=str(uuid.uuid4()),
                title="Software Engineer",
                location=row.get("location") or "Remote",
                url=f"https://example.com/jobs/{company_id}",
                posted_date=datetime.now(UTC).strftime("%Y-%m-%d"),
            ),
            CompanyJob(
                id=str(uuid.uuid4()),
                title="Product Manager",
                location=row.get("location") or "Remote",
                url=f"https://example.com/jobs/{company_id}",
                posted_date=None,
            ),
        ]
        return CompanyJobsResponse(
            company_name=company_name,
            jobs=sample_jobs,
            total=len(sample_jobs),
        )

    def save_company(
        self,
        actor: CurrentActor,
        *,
        company_name: str,
        notes: str | None = None,
    ) -> SavedCompanyResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)
        row = self._repository.save_company(
            actor=actor,
            company_name=company_name,
            notes=notes,
        )
        return _to_saved_response(row)

    def list_saved_companies(
        self,
        actor: CurrentActor,
    ) -> list[SavedCompanyResponse]:
        rows = self._repository.list_saved_companies(actor=actor)
        return [_to_saved_response(row) for row in rows]

    def delete_saved_company(
        self,
        actor: CurrentActor,
        *,
        saved_id: str,
    ) -> None:
        self._repository.delete_saved_company(actor=actor, saved_id=saved_id)


def _to_profile_response(row: dict) -> CompanyProfileResponse:
    return CompanyProfileResponse(
        id=row["id"],
        name=row["name"],
        location=row.get("location"),
        tech_stack=list(row.get("tech_stack") or []),
        team_size=row.get("team_size"),
        industry=row.get("industry"),
        description=row.get("description"),
        culture_signals=list(row.get("culture_signals") or []) or None,
        funding_stage=row.get("funding_stage"),
        growth_indicator=row.get("growth_indicator"),
        recent_job_count=row.get("recent_job_count"),
        logo_url=row.get("logo_url"),
    )


def _to_saved_response(row: dict) -> SavedCompanyResponse:
    return SavedCompanyResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id") or "",
        company_name=row["company_name"],
        notes=row.get("notes"),
        saved_at=row.get("saved_at") or row.get("created_at") or "",
    )
