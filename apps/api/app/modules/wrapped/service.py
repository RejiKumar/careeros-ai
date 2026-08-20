"""Wrapped use case: aggregate existing data into a shareable career summary."""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.auth import CurrentActor
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)

from .repository import WrappedRepository
from .schema import WrappedAchievement, WrappedDataPoint, WrappedResponse

LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]

LEVEL_NAMES = [
    "Career Explorer",
    "Job Seeker",
    "Rising Professional",
    "Career Builder",
    "Expert",
    "Leader",
    "Career Legend",
]


class WrappedService:
    def __init__(self, clients: SupabaseClients) -> None:
        self._clients = clients
        self._repository = WrappedRepository(require_service_client(clients))

    def generate(self, actor: CurrentActor) -> WrappedResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)

        is_guest = actor.kind == "guest"
        points: list[WrappedDataPoint] = []

        assessment = self._repository.get_latest_assessment(
            actor_id=actor.id, is_guest=is_guest
        )
        if assessment:
            scores = assessment.get("scores") or []
            nums = [s["score"] for s in scores if isinstance(s.get("score"), int)]
            if nums:
                points.append(
                    WrappedDataPoint(
                        key="health_score",
                        label="Resume health score",
                        value=str(sum(nums) // len(nums)),
                        available=True,
                    )
                )
            gaps = assessment.get("gaps") or []
            if gaps:
                points.append(
                    WrappedDataPoint(
                        key="biggest_opportunity",
                        label="Biggest opportunity",
                        value=str(gaps[0].get("description", "")),
                        available=True,
                    )
                )
        else:
            points.append(
                WrappedDataPoint(
                    key="health_score", label="Resume health score", value="—", available=False
                )
            )

        matched_skills = self._repository.get_latest_match_skills(
            actor_id=actor.id, is_guest=is_guest
        )
        resume_skills = self._repository.get_latest_resume_skills(
            actor_id=actor.id, is_guest=is_guest
        )
        strongest_skill = (matched_skills or resume_skills or [None])[0]
        points.append(
            WrappedDataPoint(
                key="strongest_skill",
                label="Strongest skill",
                value=strongest_skill or "—",
                available=strongest_skill is not None,
            )
        )

        achievements: list[WrappedAchievement] = []
        if not is_guest:
            total_xp = self._repository.get_total_xp(user_id=actor.id)
            level = _level(total_xp)
            points.append(
                WrappedDataPoint(
                    key="career_level",
                    label="Career level",
                    value=f"Level {level} · {LEVEL_NAMES[min(level - 1, len(LEVEL_NAMES) - 1)]}",
                    available=True,
                )
            )
            achievements = [
                WrappedAchievement(
                    key=str(row.get("key", "")),
                    title=str(row.get("title", "")),
                    earned_at=row.get("earned_at"),
                )
                for row in self._repository.list_earned_achievements(user_id=actor.id)
            ]

        return WrappedResponse(
            generated_at=datetime.now(tz=UTC).isoformat(),
            data_points=points,
            achievements=achievements,
        )


def _level(total_xp: int) -> int:
    for i, threshold in enumerate(reversed(LEVEL_THRESHOLDS)):
        if total_xp >= threshold:
            return len(LEVEL_THRESHOLDS) - i
    return 1
