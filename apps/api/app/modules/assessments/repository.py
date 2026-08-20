"""Assessment persistence backed by Supabase with the service-role client."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq

ASSESSMENTS_TABLE = "assessments"


class AssessmentRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        owner: dict,
        resume_version_id: str,
        request_id: str | None,
        model_version: str,
        prompt_version: str | None,
        status: str,
        scores: list[dict],
        strengths: list[str],
        evidence: list[str],
        gaps: list[dict],
    ) -> dict:
        rows = (
            self._client.table(ASSESSMENTS_TABLE)
            .insert(
                {
                    **owner,
                    "resume_version_id": resume_version_id,
                    "request_id": request_id,
                    "model_version": model_version,
                    "prompt_version": prompt_version,
                    "status": status,
                    "scores": scores,
                    "strengths": strengths,
                    "evidence": evidence,
                    "gaps": gaps,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, actor: CurrentActor, assessment_id: str) -> dict | None:
        query = self._client.table(ASSESSMENTS_TABLE).select("*").eq("id", assessment_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None
