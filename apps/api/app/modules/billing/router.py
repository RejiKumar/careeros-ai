"""Billing router."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.ai_quota import AiQuota, AiUsage
from app.core.auth import CurrentActor, CurrentUser, get_current_actor, get_current_user
from app.core.config import Settings, get_settings
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import EntitlementResponse
from .service import BillingService

router = APIRouter(prefix="/billing", tags=["billing"])


def get_billing_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
) -> BillingService:
    return BillingService(clients)


@router.get("/entitlements", response_model=EntitlementResponse)
def get_entitlements(
    service: Annotated[BillingService, Depends(get_billing_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> EntitlementResponse:
    return service.get_entitlement(user)


@router.get("/ai-usage", response_model=AiUsage)
def get_ai_usage(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    settings: Annotated[Settings, Depends(get_settings)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> AiUsage:
    """The caller's AI actions used and remaining in the rolling 24-hour window."""
    return AiQuota(clients, settings).usage(actor)
