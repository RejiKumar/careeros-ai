"""Skills Gap Radar persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

GAP_ANALYSES_TABLE = "skill_gap_analyses"


class SkillsGapRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        actor: CurrentActor,
        resume_id: str,
        job_description_id: str,
        matched_skills: list[dict],
        partial_skills: list[dict],
        missing_skills: list[dict],
        overall_match: float,
    ) -> dict:
        rows = (
            self._client.table(GAP_ANALYSES_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "resume_id": resume_id,
                    "job_description_id": job_description_id,
                    "matched_skills": matched_skills,
                    "partial_skills": partial_skills,
                    "missing_skills": missing_skills,
                    "overall_match": overall_match,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, actor: CurrentActor, analysis_id: str) -> dict | None:
        query = self._client.table(GAP_ANALYSES_TABLE).select("*").eq("id", analysis_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def list_by_user(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(GAP_ANALYSES_TABLE).select("*")
        return owner_eq(query, actor).order("created_at", desc=True).execute().data

    def delete(self, *, actor: CurrentActor, analysis_id: str) -> None:
        query = self._client.table(GAP_ANALYSES_TABLE).delete().eq("id", analysis_id)
        owner_eq(query, actor).execute()
