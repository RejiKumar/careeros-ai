"""Assessment endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel

from app.ai.schemas import GapFinding, HealthDimensionScore


class AssessmentResponse(BaseModel):
    id: str
    resume_id: str | None
    resume_version_id: str
    status: str
    scores: list[HealthDimensionScore]
    strengths: list[str]
    gaps: list[GapFinding]
    evidence: list[str]
    model_version: str | None
    prompt_version: str | None
    created_at: str
