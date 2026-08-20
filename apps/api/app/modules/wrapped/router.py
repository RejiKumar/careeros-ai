"""Wrapped router: thin HTTP layer over the wrapped service."""

from __future__ import annotations

from typing import Annotated

from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from fastapi import APIRouter, Depends

from .schema import WrappedResponse
from .service import WrappedService

router = APIRouter(prefix="/wrapped", tags=["wrapped"])


def get_wrapped_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
) -> WrappedService:
    return WrappedService(clients)


@router.get("", response_model=WrappedResponse)
def generate_wrapped(
    service: Annotated[WrappedService, Depends(get_wrapped_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> WrappedResponse:
    return service.generate(actor)
