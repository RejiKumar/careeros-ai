"""Job description and match persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

JOB_DESCRIPTIONS_TABLE = "job_descriptions"
JOB_MATCHES_TABLE = "job_matches"


class JobDescriptionRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        actor: CurrentActor,
        title: str | None,
        company: str | None,
        raw_text: str,
        normalized_text: str | None,
        resume_id: str | None = None,
    ) -> dict:
        rows = (
            self._client.table(JOB_DESCRIPTIONS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "title": title,
                    "company": company,
                    "raw_text": raw_text,
                    "normalized_text": normalized_text,
                    "resume_id": resume_id,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, actor: CurrentActor, job_description_id: str) -> dict | None:
        query = self._client.table(JOB_DESCRIPTIONS_TABLE).select("*").eq("id", job_description_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def list(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(JOB_DESCRIPTIONS_TABLE).select("*")
        return owner_eq(query, actor).order("created_at", desc=True).execute().data

    def update(
        self,
        *,
        actor: CurrentActor,
        job_description_id: str,
        title: str | None = None,
        company: str | None = None,
        raw_text: str | None = None,
        normalized_text: str | None = None,
    ) -> dict | None:
        updates: dict = {}
        if title is not None:
            updates["title"] = title
        if company is not None:
            updates["company"] = company
        if raw_text is not None:
            updates["raw_text"] = raw_text
        if normalized_text is not None:
            updates["normalized_text"] = normalized_text
        if not updates:
            return self.get(actor=actor, job_description_id=job_description_id)
        query = (
            self._client.table(JOB_DESCRIPTIONS_TABLE)
            .update(updates)
            .eq("id", job_description_id)
        )
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def delete(self, *, actor: CurrentActor, job_description_id: str) -> None:
        query = self._client.table(JOB_DESCRIPTIONS_TABLE).delete().eq("id", job_description_id)
        owner_eq(query, actor).execute()

    def get_match(self, *, actor: CurrentActor, match_id: str) -> dict | None:
        query = self._client.table(JOB_MATCHES_TABLE).select("*").eq("id", match_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def create_match(
        self,
        *,
        actor: CurrentActor,
        job_description_id: str,
        resume_version_id: str,
        request_id: str | None,
        model_version: str,
        score: int,
        matched_skills: list[str],
        missing_skills: list[str],
        strengths: list[str],
        actions: list[dict],
    ) -> dict:
        rows = (
            self._client.table(JOB_MATCHES_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "job_description_id": job_description_id,
                    "resume_version_id": resume_version_id,
                    "request_id": request_id,
                    "model_version": model_version,
                    "score": score,
                    "matched_skills": matched_skills,
                    "missing_skills": missing_skills,
                    "strengths": strengths,
                    "actions": actions,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def list_matches(self, *, actor: CurrentActor, job_description_id: str) -> list[dict]:
        query = (
            self._client.table(JOB_MATCHES_TABLE)
            .select("*")
            .eq("job_description_id", job_description_id)
        )
        return owner_eq(query, actor).order("created_at", desc=True).execute().data
