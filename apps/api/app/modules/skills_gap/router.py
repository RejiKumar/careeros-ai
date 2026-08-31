"""Skills Gap Radar router: thin HTTP layer over the skills gap service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    GapAnalysisHistoryResponse,
    GapAnalysisRequest,
    GapAnalysisResponse,
)
from .service import SkillsGapService

router = APIRouter(prefix="/skills-gap", tags=["skills-gap"])


def get_skills_gap_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> SkillsGapService:
    return SkillsGapService(clients, provider)


@router.post("/analyze", response_model=GapAnalysisResponse, status_code=201)
def analyze_gap(
    payload: GapAnalysisRequest,
    service: Annotated[SkillsGapService, Depends(get_skills_gap_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> GapAnalysisResponse:
    return service.analyze_gap(
        actor,
        resume_id=payload.resume_id,
        job_description_id=payload.job_description_id,
        resume_version_id=payload.resume_version_id,
    )


@router.get("/{analysis_id}", response_model=GapAnalysisResponse)
def get_analysis(
    analysis_id: str,
    service: Annotated[SkillsGapService, Depends(get_skills_gap_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> GapAnalysisResponse:
    return service.get_analysis(actor, analysis_id=analysis_id)


@router.get("", response_model=GapAnalysisHistoryResponse)
def list_analyses(
    service: Annotated[SkillsGapService, Depends(get_skills_gap_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> GapAnalysisHistoryResponse:
    return service.list_analyses(actor)


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(
    analysis_id: str,
    service: Annotated[SkillsGapService, Depends(get_skills_gap_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_analysis(actor, analysis_id=analysis_id)
