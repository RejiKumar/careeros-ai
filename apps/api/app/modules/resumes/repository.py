"""Resume persistence backed by Supabase with the service-role client.

Writes run server-side so RLS (which is user-scoped) is bypassed only for
authorized use cases. Every row still carries the owning user_id or guest_id.
"""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq

RESUMES_TABLE = "resumes"
VERSIONS_TABLE = "resume_versions"


class ResumeRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create_resume(self, *, owner: dict, title: str) -> dict:
        rows = self._client.table(RESUMES_TABLE).insert({**owner, "title": title}).execute().data
        return rows[0]

    def create_version(
        self,
        *,
        resume_id: str,
        owner: dict,
        version: int,
        source: str,
        structured_data: dict,
        source_request_id: str | None,
    ) -> dict:
        rows = (
            self._client.table(VERSIONS_TABLE)
            .insert(
                {
                    **owner,
                    "resume_id": resume_id,
                    "version": version,
                    "source": source,
                    "structured_data": structured_data,
                    "source_request_id": source_request_id,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def set_current_version(self, *, resume_id: str, version_id: str) -> None:
        self._client.table(RESUMES_TABLE).update({"current_version_id": version_id}).eq(
            "id", resume_id
        ).execute()

    def update_title(self, *, resume_id: str, title: str) -> None:
        self._client.table(RESUMES_TABLE).update({"title": title}).eq("id", resume_id).execute()

    def delete_resume(self, *, resume_id: str) -> None:
        self._client.table(RESUMES_TABLE).delete().eq("id", resume_id).execute()

    def get_latest_version(self, *, resume_id: str) -> dict | None:
        rows = (
            self._client.table(VERSIONS_TABLE)
            .select("*")
            .eq("resume_id", resume_id)
            .order("version", desc=True)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_resumes(self, *, actor: CurrentActor) -> list[dict]:
        return (
            owner_eq(self._client.table(RESUMES_TABLE).select("*"), actor)
            .order("updated_at", desc=True)
            .execute()
            .data
        )

    def get_resume(self, *, actor: CurrentActor, resume_id: str) -> dict | None:
        rows = (
            owner_eq(self._client.table(RESUMES_TABLE).select("*").eq("id", resume_id), actor)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def get_version(self, *, resume_id: str, version_id: str) -> dict | None:
        rows = (
            self._client.table(VERSIONS_TABLE)
            .select("*")
            .eq("id", version_id)
            .eq("resume_id", resume_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def get_version_by_id(self, *, version_id: str, actor: CurrentActor) -> dict | None:
        rows = (
            owner_eq(self._client.table(VERSIONS_TABLE).select("*").eq("id", version_id), actor)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_versions(self, *, resume_id: str) -> list[dict]:
        return (
            self._client.table(VERSIONS_TABLE)
            .select("*")
            .eq("resume_id", resume_id)
            .order("version", desc=True)
            .execute()
            .data
        )
