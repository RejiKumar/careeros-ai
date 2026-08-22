"""Job description router: thin HTTP layer over the job match service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.core.i18n import get_request_locale
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    JobDescriptionMatchResponse,
    JobDescriptionRequest,
    JobDescriptionResponse,
    JobDescriptionUpdateRequest,
    MatchResponse,
    MatchRunRequest,
)
from .service import JobMatchService

router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])


def get_job_match_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> JobMatchService:
    return JobMatchService(clients, provider)


@router.post("", response_model=JobDescriptionMatchResponse, status_code=201)
def create_job_description(
    payload: JobDescriptionRequest,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> JobDescriptionMatchResponse:
    return service.create_with_match(
        actor,
        title=payload.title,
        company=payload.company,
        raw_text=payload.raw_text,
        resume_id=payload.resume_id,
        resume_version_id=payload.resume_version_id,
        locale=locale,
    )


@router.get("", response_model=list[JobDescriptionResponse])
def list_job_descriptions(
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[JobDescriptionResponse]:
    return service.list_job_descriptions(actor)


@router.get("/{job_description_id}", response_model=JobDescriptionResponse)
def get_job_description(
    job_description_id: str,
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> JobDescriptionResponse:
    return service.get_job_description(actor, job_description_id)


@router.get("/{job_description_id}/matches", response_model=list[MatchResponse])
def list_matches(
    job_description_id: str,
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[MatchResponse]:
    return service.list_matches(actor, job_description_id)


@router.patch("/{job_description_id}", response_model=JobDescriptionResponse)
def update_job_description(
    job_description_id: str,
    payload: JobDescriptionUpdateRequest,
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> JobDescriptionResponse:
    return service.update_job_description(
        actor,
        job_description_id,
        title=payload.title,
        company=payload.company,
        raw_text=payload.raw_text,
    )


@router.delete("/{job_description_id}", status_code=204)
def delete_job_description(
    job_description_id: str,
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_job_description(actor, job_description_id)


@router.post("/{job_description_id}/matches", response_model=MatchResponse, status_code=201)
def run_match(
    job_description_id: str,
    payload: MatchRunRequest,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[JobMatchService, Depends(get_job_match_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> MatchResponse:
    return service.run_match(
        actor,
        job_description_id,
        resume_id=payload.resume_id,
        resume_version_id=payload.resume_version_id,
        locale=locale,
    )
