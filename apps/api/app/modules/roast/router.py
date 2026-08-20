"""Roast router: thin HTTP layer over the roast service."""

from __future__ import annotations

from typing import Annotated

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from fastapi import APIRouter, Depends

from .schema import RoastCreateRequest, RoastResponse
from .service import RoastService

router = APIRouter(prefix="/roasts", tags=["roasts"])


def get_roast_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> RoastService:
    return RoastService(clients, provider)


@router.post("", response_model=RoastResponse, status_code=201)
def create_roast(
    payload: RoastCreateRequest,
    service: Annotated[RoastService, Depends(get_roast_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> RoastResponse:
    return service.create_roast(actor, payload)
