"""Application tracker persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

APPLICATIONS_TABLE = "applications"


class ApplicationRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create(
        self,
        *,
        actor: CurrentActor,
        job_id: str | None,
        job_title: str,
        company: str,
        status: str,
        notes: str | None,
        url: str | None,
        applied_at: str | None,
        interview_date: str | None,
        follow_up_date: str | None,
    ) -> dict:
        rows = (
            self._client.table(APPLICATIONS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "job_id": job_id,
                    "job_title": job_title,
                    "company": company,
                    "status": status,
                    "notes": notes,
                    "url": url,
                    "applied_at": applied_at,
                    "interview_date": interview_date,
                    "follow_up_date": follow_up_date,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get(self, *, actor: CurrentActor, application_id: str) -> dict | None:
        query = self._client.table(APPLICATIONS_TABLE).select("*").eq("id", application_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def list_by_user(self, *, actor: CurrentActor, status_filter: str | None = None) -> list[dict]:
        query = self._client.table(APPLICATIONS_TABLE).select("*")
        if status_filter is not None:
            query = query.eq("status", status_filter)
        return owner_eq(query, actor).order("created_at", desc=True).execute().data

    def update(
        self,
        *,
        actor: CurrentActor,
        application_id: str,
        status: str | None = None,
        notes: str | None = None,
        interview_date: str | None = None,
        follow_up_date: str | None = None,
    ) -> dict | None:
        updates: dict = {}
        if status is not None:
            updates["status"] = status
        if notes is not None:
            updates["notes"] = notes
        if interview_date is not None:
            updates["interview_date"] = interview_date
        if follow_up_date is not None:
            updates["follow_up_date"] = follow_up_date
        if not updates:
            return self.get(actor=actor, application_id=application_id)
        query = self._client.table(APPLICATIONS_TABLE).update(updates).eq("id", application_id)
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def delete(self, *, actor: CurrentActor, application_id: str) -> None:
        query = self._client.table(APPLICATIONS_TABLE).delete().eq("id", application_id)
        owner_eq(query, actor).execute()

    def get_stats(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(APPLICATIONS_TABLE).select("*")
        return owner_eq(query, actor).execute().data
