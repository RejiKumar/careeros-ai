"""Wrapped persistence: aggregate latest score, skill, gap, level and achievements."""

from __future__ import annotations

from supabase import Client


class WrappedRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_latest_assessment(self, *, actor_id: str, is_guest: bool) -> dict | None:
        query = (
            self._client.table("assessments")
            .select("id, status, scores, gaps")
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(1)
        )
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        rows = query.execute().data
        return rows[0] if rows else None

    def get_latest_resume_skills(self, *, actor_id: str, is_guest: bool) -> list[str]:
        query = (
            self._client.table("resumes")
            .select("current_version_id")
            .order("created_at", desc=True)
            .limit(1)
        )
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        rows = query.execute().data
        if not rows or not rows[0].get("current_version_id"):
            return []
        version_rows = (
            self._client.table("resume_versions")
            .select("structured_data")
            .eq("id", rows[0]["current_version_id"])
            .execute()
            .data
        )
        if not version_rows:
            return []
        structured = version_rows[0].get("structured_data") or {}
        skills = structured.get("skills") or []
        return [str(skill) for skill in skills]

    def get_latest_match_skills(self, *, actor_id: str, is_guest: bool) -> list[str]:
        query = (
            self._client.table("job_matches")
            .select("matched_skills")
            .order("created_at", desc=True)
            .limit(1)
        )
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        rows = query.execute().data
        if not rows:
            return []
        return [str(skill) for skill in (rows[0].get("matched_skills") or [])]

    def get_total_xp(self, *, user_id: str) -> int:
        rows = (
            self._client.table("mission_completions")
            .select("xp_awarded")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return sum(row.get("xp_awarded", 0) for row in rows)

    def list_earned_achievements(self, *, user_id: str) -> list[dict]:
        earned = (
            self._client.table("user_achievements")
            .select("achievement_id, earned_at")
            .eq("user_id", user_id)
            .order("earned_at", desc=True)
            .execute()
            .data
        )
        if not earned:
            return []
        ids = [row["achievement_id"] for row in earned]
        definition_rows = (
            self._client.table("achievements")
            .select("id, key, title")
            .in_("id", ids)
            .execute()
            .data
        )
        by_id = {row["id"]: row for row in definition_rows}
        return [
            {
                "key": by_id.get(row["achievement_id"], {}).get("key", ""),
                "title": by_id.get(row["achievement_id"], {}).get("title", ""),
                "earned_at": row.get("earned_at"),
            }
            for row in earned
        ]
