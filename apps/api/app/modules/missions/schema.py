"""Missions and dashboard endpoint schemas."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class MissionResponse(BaseModel):
    id: str
    key: str
    title: str
    description: str | None = None
    xp_reward: int
    cadence: str
    is_active: bool


class MissionProgressResponse(BaseModel):
    total_xp: int
    level: int
    current_streak: int
    missions_completed: int
    completions: list[MissionCompletionResponse]


class MissionCompletionResponse(BaseModel):
    mission_id: str
    mission_key: str
    completed_on: date
    xp_awarded: int


class MissionCompleteResponse(BaseModel):
    mission_key: str
    xp_awarded: int
    new_total_xp: int
    already_completed: bool = False


class DashboardResponse(BaseModel):
    health_score: int | None = None
    health_level: str | None = None
    latest_match_score: int | None = None
    latest_match_jd_title: str | None = None
    total_xp: int
    level: int
    current_streak: int
    active_missions: list[MissionResponse]
    recent_completions: list[MissionCompletionResponse]
    achievements: list[AchievementResponse] = Field(default_factory=list)


class AchievementResponse(BaseModel):
    id: str
    key: str
    title: str
    description: str
    condition: str
    earned_at: str | None = None
