"""Market Pulse router: thin HTTP layer over the market pulse service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import MarketPulseResponse, SkillTrendResponse
from .service import MarketPulseService

router = APIRouter(prefix="/market-pulse", tags=["market-pulse"])


def get_market_pulse_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> MarketPulseService:
    return MarketPulseService(clients, provider)


@router.get("", response_model=MarketPulseResponse)
def get_market_pulse(
    service: Annotated[MarketPulseService, Depends(get_market_pulse_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
    location: Annotated[str | None, Query()] = None,
    role: Annotated[str | None, Query()] = None,
) -> MarketPulseResponse:
    return service.get_market_pulse(actor, location=location, role=role)


@router.get("/trends", response_model=SkillTrendResponse)
def get_skill_trends(
    service: Annotated[MarketPulseService, Depends(get_market_pulse_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
    period: Annotated[str, Query()] = "6m",
    location: Annotated[str | None, Query()] = None,
) -> SkillTrendResponse:
    return service.get_skill_trends(actor, period=period, location=location)
