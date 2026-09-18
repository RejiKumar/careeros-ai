"""Job search router: thin HTTP layer over the job search service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import CurrentActor, get_current_actor
from app.integrations.job_search.provider import (
    JobSearchProvider,
    get_job_search_provider,
)
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    AlertPreferenceRequest,
    JobAlertPreference,
    JobSearchRequest,
    JobSearchResponse,
    SavedJobResponse,
    SaveJobRequest,
)
from .service import JobSearchService

router = APIRouter(prefix="/job-search", tags=["job-search"])


def get_job_search_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[JobSearchProvider, Depends(get_job_search_provider)],
) -> JobSearchService:
    return JobSearchService(clients, provider)


@router.post("/search", response_model=JobSearchResponse)
def search_jobs(
    payload: JobSearchRequest,
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> JobSearchResponse:
    return service.search_jobs(
        actor,
        query=payload.query,
        location=payload.location,
        source=payload.source,
        page=payload.page,
        limit=payload.limit,
    )


@router.post("/saved", response_model=SavedJobResponse, status_code=201)
def save_job(
    payload: SaveJobRequest,
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> SavedJobResponse:
    return service.save_job(
        actor,
        job_id=payload.job_id,
        job_title=payload.job_title,
        company=payload.company,
        source=payload.source,
        url=payload.url,
        match_score=payload.match_score,
    )


@router.get("/saved", response_model=list[SavedJobResponse])
def list_saved_jobs(
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[SavedJobResponse]:
    return service.list_saved_jobs(actor)


@router.delete("/saved/{job_id}", status_code=204)
def delete_saved_job(
    job_id: str,
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_saved_job(actor, job_id=job_id)


@router.put("/alerts", response_model=JobAlertPreference)
def upsert_alert_preference(
    payload: AlertPreferenceRequest,
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> JobAlertPreference:
    return service.update_alert_preference(
        actor,
        query=payload.query,
        location=payload.location,
        min_match_score=payload.min_match_score,
        frequency=payload.frequency,
        enabled=payload.enabled,
    )


@router.get("/alerts", response_model=JobAlertPreference | None)
def get_alert_preference(
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> JobAlertPreference | None:
    return service.get_alert_preference(actor)


@router.delete("/alerts", status_code=204)
def delete_alert_preference(
    service: Annotated[JobSearchService, Depends(get_job_search_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_alert_preference(actor)
