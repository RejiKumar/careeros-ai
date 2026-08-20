"""Mission persistence backed by Supabase (service-role client)."""
from __future__ import annotations

from datetime import date

from supabase import Client

MISSIONS_TABLE = "missions"
COMPLETIONS_TABLE = "mission_completions"


class MissionRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def list_active(self) -> list[dict]:
        return (
            self._client.table(MISSIONS_TABLE)
            .select("*")
            .eq("is_active", True)
            .execute()
            .data
        )

    def get_by_key(self, *, mission_key: str) -> dict | None:
        rows = (
            self._client.table(MISSIONS_TABLE)
            .select("*")
            .eq("key", mission_key)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def get_completion(
        self, *, user_id: str, mission_id: str, completed_on: date
    ) -> dict | None:
        rows = (
            self._client.table(COMPLETIONS_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .eq("mission_id", mission_id)
            .eq("completed_on", completed_on.isoformat())
            .execute()
            .data
        )
        return rows[0] if rows else None

    def create_completion(
        self, *, user_id: str, mission_id: str, completed_on: date, xp_awarded: int
    ) -> dict:
        rows = (
            self._client.table(COMPLETIONS_TABLE)
            .insert(
                {
                    "user_id": user_id,
                    "mission_id": mission_id,
                    "completed_on": completed_on.isoformat(),
                    "xp_awarded": xp_awarded,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def list_completions(self, *, user_id: str) -> list[dict]:
        return (
            self._client.table(COMPLETIONS_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("completed_on", desc=True)
            .execute()
            .data
        )

    def get_mission_key(self, *, mission_id: str) -> str:
        rows = (
            self._client.table(MISSIONS_TABLE)
            .select("key")
            .eq("id", mission_id)
            .execute()
            .data
        )
        return rows[0]["key"] if rows else ""

    def get_total_xp(self, *, user_id: str) -> int:
        rows = (
            self._client.table(COMPLETIONS_TABLE)
            .select("xp_awarded")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return sum(row.get("xp_awarded", 0) for row in rows)

    def get_completion_dates(self, *, user_id: str) -> list[date]:
        rows = (
            self._client.table(COMPLETIONS_TABLE)
            .select("completed_on")
            .eq("user_id", user_id)
            .order("completed_on", desc=True)
            .execute()
            .data
        )
        seen: set[date] = set()
        result: list[date] = []
        for row in rows:
            d = date.fromisoformat(row["completed_on"])
            if d not in seen:
                seen.add(d)
                result.append(d)
        return result

    def get_latest_assessment(self, *, user_id: str) -> dict | None:
        rows = (
            self._client.table("assessments")
            .select("id, status, scores")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def get_latest_match(self, *, user_id: str) -> dict | None:
        rows = (
            self._client.table("job_matches")
            .select("score, job_description_id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def get_jd_title(self, *, jd_id: str) -> str | None:
        rows = (
            self._client.table("job_descriptions")
            .select("title")
            .eq("id", jd_id)
            .execute()
            .data
        )
        return rows[0].get("title") if rows else None

    def list_achievements(self) -> list[dict]:
        return (
            self._client.table("achievements")
            .select("*")
            .order("key")
            .execute()
            .data
        )

    def list_earned_achievements(self, *, user_id: str) -> dict[str, str]:
        rows = (
            self._client.table("user_achievements")
            .select("achievement_id, earned_at")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return {row["achievement_id"]: row["earned_at"] for row in rows}

    def award_achievement(self, *, user_id: str, achievement_id: str) -> None:
        self._client.table("user_achievements").insert(
            {"user_id": user_id, "achievement_id": achievement_id}
        ).execute()

    def count_completed_assessments(self, *, user_id: str) -> int:
        rows = (
            self._client.table("assessments")
            .select("id")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
            .data
        )
        return len(rows)

    def get_best_assessment_score(self, *, user_id: str) -> int | None:
        rows = (
            self._client.table("assessments")
            .select("scores")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        scores = rows[0].get("scores") or []
        nums = [s["score"] for s in scores if isinstance(s.get("score"), int)]
        return sum(nums) // len(nums) if nums else None

    def count_interview_sessions(self, *, user_id: str) -> int:
        rows = (
            self._client.table("interview_sessions")
            .select("id")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return len(rows)
