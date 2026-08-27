"""Career path endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class CareerPathRequest(BaseModel):
    resume_id: str
    target_role: str | None = None


class CareerStage(BaseModel):
    title: str
    description: str
    typical_years: int
    required_skills: list[str]
    recommended_actions: list[str]


class CareerPathResponse(BaseModel):
    current_stage: str
    stages: list[CareerStage]
    gap_analysis: list[str]
    timeline_estimate: str
    generated_at: str


class SavedCareerPathResponse(BaseModel):
    id: str
    user_id: str
    target_role: str
    path_data: str
    created_at: str
