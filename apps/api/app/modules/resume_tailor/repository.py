"""Resume tailor persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

TAILOR_HISTORY_TABLE = "resume_tailor_history"


class ResumeTailorRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        actor: CurrentActor,
        resume_id: str,
        job_description_id: str,
        original_version_id: str,
        tailored_version_id: str | None,
        tailored_content: dict,
        diffs: list[dict],
        accepted: bool = False,
    ) -> dict:
        rows = (
            self._client.table(TAILOR_HISTORY_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "resume_id": resume_id,
                    "job_description_id": job_description_id,
                    "original_version_id": original_version_id,
                    "tailored_version_id": tailored_version_id,
                    "tailored_content": tailored_content,
                    "diffs": diffs,
                    "accepted": accepted,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, actor: CurrentActor, tailor_id: str) -> dict | None:
        query = self._client.table(TAILOR_HISTORY_TABLE).select("*").eq("id", tailor_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def list_by_user(self, *, actor: CurrentActor, resume_id: str) -> list[dict]:
        query = (
            self._client.table(TAILOR_HISTORY_TABLE)
            .select("*")
            .eq("resume_id", resume_id)
        )
        return owner_eq(query, actor).order("created_at", desc=True).execute().data

    def update_acceptance(
        self,
        *,
        actor: CurrentActor,
        tailor_id: str,
        tailored_version_id: str | None,
    ) -> dict | None:
        updates: dict = {"accepted": True}
        if tailored_version_id is not None:
            updates["tailored_version_id"] = tailored_version_id
        query = (
            self._client.table(TAILOR_HISTORY_TABLE)
            .update(updates)
            .eq("id", tailor_id)
        )
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def delete(self, *, actor: CurrentActor, tailor_id: str) -> None:
        query = self._client.table(TAILOR_HISTORY_TABLE).delete().eq("id", tailor_id)
        owner_eq(query, actor).execute()
