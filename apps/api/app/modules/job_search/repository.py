"""Job search persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

SAVED_JOBS_TABLE = "saved_jobs"
JOB_ALERTS_TABLE = "job_alert_preferences"


class JobSearchRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def save_job(
        self,
        *,
        actor: CurrentActor,
        job_id: str,
        job_title: str,
        company: str,
        source: str,
        url: str,
        match_score: float | None = None,
    ) -> dict:
        rows = (
            self._client.table(SAVED_JOBS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "job_id": job_id,
                    "job_title": job_title,
                    "company": company,
                    "source": source,
                    "url": url,
                    "match_score": match_score,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def list_saved_jobs(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(SAVED_JOBS_TABLE).select("*")
        return owner_eq(query, actor).order("saved_at", desc=True).execute().data

    def delete_saved_job(self, *, actor: CurrentActor, job_id: str) -> None:
        query = self._client.table(SAVED_JOBS_TABLE).delete().eq("job_id", job_id)
        owner_eq(query, actor).execute()

    def upsert_alert_preference(
        self,
        *,
        actor: CurrentActor,
        query_text: str,
        location: str | None,
        min_match_score: float,
        frequency: str,
        enabled: bool,
    ) -> dict:
        existing = self.get_alert_preference(actor=actor)
        if existing is not None:
            rows = (
                self._client.table(JOB_ALERTS_TABLE)
                .update(
                    {
                        "query": query_text,
                        "location": location,
                        "min_match_score": min_match_score,
                        "frequency": frequency,
                        "enabled": enabled,
                    }
                )
                .eq("id", existing["id"])
                .execute()
                .data
            )
            return rows[0]
        rows = (
            self._client.table(JOB_ALERTS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "query": query_text,
                    "location": location,
                    "min_match_score": min_match_score,
                    "frequency": frequency,
                    "enabled": enabled,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get_alert_preference(self, *, actor: CurrentActor) -> dict | None:
        query = self._client.table(JOB_ALERTS_TABLE).select("*")
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def delete_alert_preference(self, *, actor: CurrentActor) -> None:
        query = self._client.table(JOB_ALERTS_TABLE).delete()
        owner_eq(query, actor).execute()
