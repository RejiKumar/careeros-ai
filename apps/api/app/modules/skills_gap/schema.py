"""Skills Gap Radar endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class GapAnalysisRequest(BaseModel):
    resume_id: str
    job_description_id: str
    resume_version_id: str | None = None


class LearningResource(BaseModel):
    title: str
    url: str | None = None
    type: str
    provider: str | None = None


class SkillGap(BaseModel):
    skill: str
    status: str
    resume_evidence: str | None = None
    job_requirement: str
    confidence: float
    learning_resources: list[LearningResource] | None = None


class GapAnalysisResponse(BaseModel):
    id: str
    user_id: str
    resume_id: str
    job_description_id: str
    matched_skills: list[SkillGap]
    partial_skills: list[SkillGap]
    missing_skills: list[SkillGap]
    overall_match: float
    created_at: str


class GapAnalysisHistoryResponse(BaseModel):
    analyses: list[GapAnalysisResponse]
    total: int
