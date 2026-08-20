"""Billing and usage persistence backed by Supabase (service-role client)."""
from __future__ import annotations

from supabase import Client

USAGE_TABLE = "usage_events"
ENTITLEMENTS_TABLE = "entitlements"

FREE_LIMITS: dict[str, int | None] = {
    "assess": 5,
    "match": 5,
    "rewrite": 3,
    "coach": 20,
}

PRO_LIMITS: dict[str, int | None] = {
    "assess": None,
    "match": None,
    "rewrite": None,
    "coach": None,
}


class BillingRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_entitlement(self, *, user_id: str) -> dict | None:
        rows = (
            self._client.table(ENTITLEMENTS_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def get_usage(self, *, user_id: str) -> dict[str, int]:
        rows = (
            self._client.table(USAGE_TABLE)
            .select("feature, quantity")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        usage: dict[str, int] = {}
        for row in rows:
            feature = row["feature"]
            usage[feature] = usage.get(feature, 0) + row.get("quantity", 1)
        return usage

    def record_usage(
        self, *, user_id: str, feature: str, event_key: str, quantity: int = 1
    ) -> None:
        self._client.table(USAGE_TABLE).insert(
            {
                "user_id": user_id,
                "feature": feature,
                "event_key": event_key,
                "quantity": quantity,
            }
        ).execute()
