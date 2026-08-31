"""Salary negotiator router: thin HTTP layer over the salary service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    BenefitsComparisonResponse,
    NegotiationResponse,
    SalaryRequest,
)
from .service import SalaryNegotiatorService

router = APIRouter(prefix="/salary-negotiator", tags=["salary-negotiator"])


def get_salary_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> SalaryNegotiatorService:
    return SalaryNegotiatorService(clients, provider)


@router.post("/range", response_model=NegotiationResponse)
def get_salary_range(
    payload: SalaryRequest,
    service: Annotated[SalaryNegotiatorService, Depends(get_salary_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> NegotiationResponse:
    return service.get_salary_range(
        actor,
        role=payload.role,
        location=payload.location,
        experience_years=payload.experience_years,
        skills=payload.skills,
        company=payload.company,
    )


@router.post("/benefits", response_model=BenefitsComparisonResponse)
def get_benefits_comparison(
    payload: SalaryRequest,
    service: Annotated[SalaryNegotiatorService, Depends(get_salary_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> BenefitsComparisonResponse:
    return service.get_benefits_comparison(
        actor,
        role=payload.role,
        company=payload.company,
    )
