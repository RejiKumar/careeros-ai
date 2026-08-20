"""Billing and entitlement use cases."""
from __future__ import annotations

from fastapi import status

from app.core.auth import CurrentUser
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import FREE_LIMITS, PRO_LIMITS, BillingRepository
from .schema import EntitlementResponse


class QuotaExceededError(AppError):
    def __init__(self, feature: str) -> None:
        super().__init__(
            code="quota_exceeded",
            message=f"You have reached your free limit for {feature}. "
            "Upgrade to Pro for unlimited access.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class BillingService:
    def __init__(self, clients: SupabaseClients) -> None:
        service_client = require_service_client(clients)
        self._repository = BillingRepository(service_client)

    def get_entitlement(self, user: CurrentUser) -> EntitlementResponse:
        row = self._repository.get_entitlement(user_id=user.id)
        plan = (row or {}).get("plan", "free")
        entitle_status = (row or {}).get("status", "active")
        usage = self._repository.get_usage(user_id=user.id)
        limits = (
            PRO_LIMITS if plan == "pro" and entitle_status == "active" else FREE_LIMITS
        )
        return EntitlementResponse(
            plan=plan,
            status=entitle_status,
            usage=usage,
            limits=limits,
        )

    def check_quota(self, user: CurrentUser, feature: str) -> None:
        usage = self._repository.get_usage(user_id=user.id)
        current = usage.get(feature, 0)
        row = self._repository.get_entitlement(user_id=user.id)
        plan = (row or {}).get("plan", "free")
        entitle_status = (row or {}).get("status", "active")
        limits = (
            PRO_LIMITS if plan == "pro" and entitle_status == "active" else FREE_LIMITS
        )
        limit = limits.get(feature)
        if limit is not None and current >= limit:
            raise QuotaExceededError(feature)

    def record_usage(
        self, user: CurrentUser, feature: str, event_key: str, quantity: int = 1
    ) -> None:
        self._repository.record_usage(
            user_id=user.id, feature=feature, event_key=event_key, quantity=quantity
        )
