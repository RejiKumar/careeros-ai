"""Assessment router: thin HTTP layer over the assessment service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.core.i18n import get_request_locale
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import AssessmentResponse
from .service import AssessmentService

router = APIRouter(tags=["assessments"])


def get_assessment_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> AssessmentService:
    return AssessmentService(clients, provider)


@router.post("/resumes/{resume_id}/assessments", response_model=AssessmentResponse, status_code=201)
def create_assessment(
    resume_id: str,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> AssessmentResponse:
    return service.create_assessment(actor, resume_id, locale=locale)


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: str,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> AssessmentResponse:
    return service.get_assessment(actor, assessment_id)
