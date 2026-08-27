"""Career path persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

CAREER_PATHS_TABLE = "career_paths"


class CareerPathRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        actor: CurrentActor,
        target_role: str,
        path_data: str,
    ) -> dict:
        rows = (
            self._client.table(CAREER_PATHS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "target_role": target_role,
                    "path_data": path_data,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, actor: CurrentActor, path_id: str) -> dict | None:
        query = self._client.table(CAREER_PATHS_TABLE).select("*").eq("id", path_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def list_by_user(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(CAREER_PATHS_TABLE).select("*")
        return owner_eq(query, actor).order("created_at", desc=True).execute().data

    def delete(self, *, actor: CurrentActor, path_id: str) -> None:
        query = self._client.table(CAREER_PATHS_TABLE).delete().eq("id", path_id)
        owner_eq(query, actor).execute()
