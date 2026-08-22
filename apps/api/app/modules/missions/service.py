"""Mission and dashboard use cases."""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import status

from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)

from .repository import MissionRepository
from .schema import (
    AchievementResponse,
    DashboardResponse,
    MissionCompleteResponse,
    MissionCompletionResponse,
    MissionProgressResponse,
    MissionResponse,
)

LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]


class MissionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Mission not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class MissionService:
    def __init__(self, clients: SupabaseClients) -> None:
        service_client = require_service_client(clients)
        self._clients = clients
        self._repository = MissionRepository(service_client)

    def list_missions(self) -> list[MissionResponse]:
        return [_to_mission_response(row) for row in self._repository.list_active()]

    def get_progress(self, actor: CurrentActor) -> MissionProgressResponse:
        is_guest = actor.kind == "guest"
        total_xp = self._repository.get_total_xp(actor_id=actor.id, is_guest=is_guest)
        completions = self._repository.list_completions(actor_id=actor.id, is_guest=is_guest)
        dates = self._repository.get_completion_dates(actor_id=actor.id, is_guest=is_guest)
        return MissionProgressResponse(
            total_xp=total_xp,
            level=_level(total_xp),
            current_streak=_streak(dates),
            missions_completed=len(completions),
            completions=[_to_completion_response(c) for c in completions],
        )

    def complete_mission(self, actor: CurrentActor, mission_key: str) -> MissionCompleteResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)
        mission = self._repository.get_by_key(mission_key=mission_key)
        if mission is None:
            raise MissionNotFoundError()

        is_guest = actor.kind == "guest"
        today = datetime.now(tz=UTC).date()
        existing = self._repository.get_completion(
            actor_id=actor.id, is_guest=is_guest, mission_id=mission["id"], completed_on=today
        )
        if existing is not None:
            total_xp = self._repository.get_total_xp(actor_id=actor.id, is_guest=is_guest)
            return MissionCompleteResponse(
                mission_key=mission_key,
                xp_awarded=0,
                new_total_xp=total_xp,
                already_completed=True,
            )

        xp = mission["xp_reward"]
        self._repository.create_completion(
            actor_id=actor.id,
            is_guest=is_guest,
            mission_id=mission["id"],
            completed_on=today,
            xp_awarded=xp,
        )
        self.evaluate_achievements(actor)
        total_xp = self._repository.get_total_xp(actor_id=actor.id, is_guest=is_guest)
        return MissionCompleteResponse(
            mission_key=mission_key,
            xp_awarded=xp,
            new_total_xp=total_xp,
        )

    def list_achievements(self, actor: CurrentActor) -> list[AchievementResponse]:
        definitions = self._repository.list_achievements()
        earned = self._repository.list_earned_achievements(
            actor_id=actor.id, is_guest=actor.kind == "guest"
        )
        return [
            _to_achievement_response(definition, earned.get(definition["id"]))
            for definition in definitions
        ]

    def evaluate_achievements(self, actor: CurrentActor) -> list[str]:
        """Award achievements whose conditions are met; returns new keys."""
        if actor.kind == "guest":
            return []
        definitions = self._repository.list_achievements()
        earned_ids = set(
            self._repository.list_earned_achievements(actor_id=actor.id, is_guest=False)
        )
        newly_awarded: list[str] = []

        for definition in definitions:
            if definition["id"] in earned_ids:
                continue
            condition = definition.get("condition", "")
            if self._condition_met(actor, condition):
                self._repository.award_achievement(
                    actor_id=actor.id, is_guest=False, achievement_id=definition["id"]
                )
                newly_awarded.append(definition["key"])
        return newly_awarded

    def _condition_met(self, actor: CurrentActor, condition: str) -> bool:
        if condition == "first_assessment":
            return (
                self._repository.count_completed_assessments(actor_id=actor.id, is_guest=False) >= 1
            )
        if condition == "assessment_score_gte_80":
            score = self._repository.get_best_assessment_score(actor_id=actor.id, is_guest=False)
            return score is not None and score >= 80
        if condition == "assessment_score_gte_95":
            score = self._repository.get_best_assessment_score(actor_id=actor.id, is_guest=False)
            return score is not None and score >= 95
        if condition == "first_interview":
            return self._repository.count_interview_sessions(actor_id=actor.id, is_guest=False) >= 1
        if condition == "streak_days_gte_7":
            dates = self._repository.get_completion_dates(actor_id=actor.id, is_guest=False)
            return _streak(dates) >= 7
        return False

    def get_dashboard(self, actor: CurrentActor) -> DashboardResponse:
        missions = self.list_missions()
        progress = self.get_progress(actor)
        is_guest = actor.kind == "guest"
        assessment = self._repository.get_latest_assessment(actor_id=actor.id, is_guest=is_guest)
        match = self._repository.get_latest_match(actor_id=actor.id, is_guest=is_guest)

        health_score: int | None = None
        health_level: str | None = None
        if assessment:
            scores = assessment.get("scores") or []
            nums = [s["score"] for s in scores if isinstance(s.get("score"), int)]
            if nums:
                health_score = sum(nums) // len(nums)
                if health_score >= 70:
                    health_level = "high"
                elif health_score >= 40:
                    health_level = "medium"
                else:
                    health_level = "low"

        match_score: int | None = None
        match_title: str | None = None
        if match:
            match_score = match.get("score")
            jd_id = match.get("job_description_id")
            if jd_id:
                match_title = self._repository.get_jd_title(jd_id=jd_id)

        return DashboardResponse(
            health_score=health_score,
            health_level=health_level,
            latest_match_score=match_score,
            latest_match_jd_title=match_title,
            total_xp=progress.total_xp,
            level=progress.level,
            current_streak=progress.current_streak,
            active_missions=missions,
            recent_completions=progress.completions[:5],
            achievements=self.list_achievements(actor),
        )


def _level(total_xp: int) -> int:
    for i, threshold in enumerate(reversed(LEVEL_THRESHOLDS)):
        if total_xp >= threshold:
            return len(LEVEL_THRESHOLDS) - i
    return 1


def _streak(dates: list[date]) -> int:
    if not dates:
        return 0
    today = datetime.now(tz=UTC).date()
    streak = 0
    check = today
    for d in dates:
        if d == check:
            streak += 1
            check = _prev_date(check)
        elif d == _prev_date(check) and streak == 0:
            streak = 1
            check = _prev_date(d)
        else:
            break
    return streak


def _prev_date(d: date) -> date:
    from datetime import timedelta

    return d - timedelta(days=1)


def _to_mission_response(row: dict) -> MissionResponse:
    return MissionResponse(
        id=row["id"],
        key=row["key"],
        title=row["title"],
        description=row.get("description"),
        xp_reward=row["xp_reward"],
        cadence=row["cadence"],
        is_active=row["is_active"],
    )


def _to_achievement_response(definition: dict, earned_at: str | None) -> AchievementResponse:
    return AchievementResponse(
        id=definition["id"],
        key=definition["key"],
        title=definition["title"],
        description=definition["description"],
        condition=definition.get("condition", ""),
        earned_at=earned_at,
    )


def _to_completion_response(row: dict) -> MissionCompletionResponse:
    return MissionCompletionResponse(
        mission_id=row["mission_id"],
        mission_key="",
        completed_on=date.fromisoformat(row["completed_on"]),
        xp_awarded=row["xp_awarded"],
    )
