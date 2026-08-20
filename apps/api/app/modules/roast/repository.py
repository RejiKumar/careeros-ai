"""Roast persistence and resume access (user or guest ownership)."""

from __future__ import annotations

from supabase import Client


class RoastRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_parsed_resume(self, *, resume_id: str, actor_id: str, is_guest: bool) -> dict | None:
        query = (
            self._client.table("resumes")
            .select("id, title, current_version_id")
            .eq("id", resume_id)
        )
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        rows = query.execute().data
        if not rows:
            return None
        resume = rows[0]
        version_id = resume.get("current_version_id")
        if not version_id:
            return None
        version_rows = (
            self._client.table("resume_versions")
            .select("structured_data")
            .eq("id", version_id)
            .execute()
            .data
        )
        if not version_rows:
            return None
        return {
            "title": resume.get("title", ""),
            "structured_data": version_rows[0].get("structured_data"),
        }

    def create_roast(
        self,
        *,
        resume_id: str,
        mode: str,
        actor_id: str,
        is_guest: bool,
        request_id: str,
        model_version: str,
        content: dict,
    ) -> dict:
        row = {
            "resume_id": resume_id,
            "mode": mode,
            "request_id": request_id,
            "model_version": model_version,
            "content": content,
        }
        if is_guest:
            row["guest_id"] = actor_id
        else:
            row["user_id"] = actor_id
        return self._client.table("roasts").insert(row).execute().data[0]
