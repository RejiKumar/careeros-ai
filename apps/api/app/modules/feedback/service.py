"""Feedback use case: one rating per AI output per identity (latest wins)."""

from __future__ import annotations

from app.core.auth import CurrentActor
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)

from .schema import FeedbackRequest, FeedbackResponse

FEEDBACK_TABLE = "feedback"


class FeedbackService:
    def __init__(self, clients: SupabaseClients) -> None:
        self._client = require_service_client(clients)
        self._clients = clients

    def upsert(self, actor: CurrentActor, payload: FeedbackRequest) -> FeedbackResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)
        
        new_row = {
            "output_type": payload.output_type,
            "output_id": payload.output_id,
            "rating": payload.rating,
            "reason": payload.reason,
            "reason_detail": payload.reason_detail,
        }
        if actor.kind == "user":
            new_row["user_id"] = actor.id
        else:
            new_row["guest_id"] = actor.id

        # Latest rating wins: remove any prior rating for this output + identity,
        # then insert the new one (the identity column enforces uniqueness).
        existing = (
            self._client.table(FEEDBACK_TABLE)
            .select("id")
            .eq("output_type", payload.output_type)
            .eq("output_id", payload.output_id)
        )
        if actor.kind == "user":
            existing = existing.eq("user_id", actor.id)
        else:
            existing = existing.eq("guest_id", actor.id)
        for prior in existing.execute().data:
            self._client.table(FEEDBACK_TABLE).delete().eq("id", prior["id"]).execute()

        created = (
            self._client.table(FEEDBACK_TABLE).insert(new_row).execute().data[0]
        )
        return FeedbackResponse(
            id=created["id"],
            output_type=created["output_type"],
            output_id=created["output_id"],
            rating=created["rating"],
            reason=created.get("reason"),
            created_at=created["created_at"],
            updated_at=created["updated_at"],
        )
