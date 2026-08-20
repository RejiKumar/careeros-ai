"""Rewrite suggestion persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

REWRITES_TABLE = "rewrite_suggestions"


class RewriteRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        user_id: str,
        resume_version_id: str,
        source_version_number: int,
        status: str,
        suggestions: list[dict],
        request_id: str | None,
        model_version: str,
    ) -> dict:
        rows = (
            self._client.table(REWRITES_TABLE)
            .insert(
                {
                    "user_id": user_id,
                    "resume_version_id": resume_version_id,
                    "source_version_number": source_version_number,
                    "status": status,
                    "suggestions": suggestions,
                    "request_id": request_id,
                    "model_version": model_version,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, user_id: str, rewrite_id: str) -> dict | None:
        rows = (
            self._client.table(REWRITES_TABLE)
            .select("*")
            .eq("id", rewrite_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_for_resume_versions(
        self, *, user_id: str, resume_version_ids: list[str]
    ) -> list[dict]:
        if not resume_version_ids:
            return []
        query = self._client.table(REWRITES_TABLE).select("*").eq("user_id", user_id)
        rows = query.in_("resume_version_id", resume_version_ids).execute().data
        return list(rows)

    def mark_accepted(self, *, rewrite_id: str, version_id: str) -> None:
        self._client.table(REWRITES_TABLE).update(
            {"status": "accepted", "accepted_version_id": version_id}
        ).eq("id", rewrite_id).execute()
