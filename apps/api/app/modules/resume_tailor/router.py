"""Resume tailor router: thin HTTP layer over the resume tailor service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.core.i18n import get_request_locale
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import AcceptTailorRequest, TailorRequest, TailorResponse
from .service import ResumeTailorService

router = APIRouter(prefix="/resume-tailor", tags=["resume-tailor"])


def get_resume_tailor_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> ResumeTailorService:
    return ResumeTailorService(clients, provider)


@router.post("/tailor", response_model=TailorResponse, status_code=201)
def tailor_resume(
    payload: TailorRequest,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[ResumeTailorService, Depends(get_resume_tailor_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> TailorResponse:
    return service.tailor_resume(
        actor,
        resume_id=payload.resume_id,
        job_description_id=payload.job_description_id,
        resume_version_id=payload.resume_version_id,
        locale=locale,
    )


@router.post("/accept", response_model=TailorResponse)
def accept_tailor(
    payload: AcceptTailorRequest,
    service: Annotated[ResumeTailorService, Depends(get_resume_tailor_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> TailorResponse:
    return service.accept_tailor(actor, tailor_id=payload.tailor_id)


@router.get("/history/{resume_id}", response_model=list[TailorResponse])
def get_tailor_history(
    resume_id: str,
    service: Annotated[ResumeTailorService, Depends(get_resume_tailor_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[TailorResponse]:
    return service.get_tailor_history(actor, resume_id=resume_id)


@router.delete("/{tailor_id}", status_code=204)
def delete_tailor(
    tailor_id: str,
    service: Annotated[ResumeTailorService, Depends(get_resume_tailor_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_tailor(actor, tailor_id=tailor_id)
