"""Resume tailor endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.ai.schemas import ResumeContent


class TailorRequest(BaseModel):
    resume_id: str
    job_description_id: str
    resume_version_id: str | None = None


class TailorDiff(BaseModel):
    field: str = Field(description='"summary", "skills", or "experience"')
    original: str
    tailored: str
    reasoning: str


class TailorResponse(BaseModel):
    id: str
    user_id: str
    resume_id: str
    job_description_id: str
    tailored_content: ResumeContent
    diffs: list[TailorDiff]
    original_version_id: str
    tailored_version_id: str | None = None
    created_at: str
    accepted: bool


class AcceptTailorRequest(BaseModel):
    tailor_id: str
