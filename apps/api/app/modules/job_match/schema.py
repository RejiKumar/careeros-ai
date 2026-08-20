"""Job description and match endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel, model_validator

from app.ai.schemas import MatchAction

MAX_JOB_DESCRIPTION_CHARS = 50_000


class JobDescriptionRequest(BaseModel):
    title: str | None = None
    company: str | None = None
    raw_text: str
    resume_id: str
    resume_version_id: str | None = None

    @model_validator(mode="after")
    def _raw_text_acceptable(self) -> JobDescriptionRequest:
        if not self.raw_text.strip():
            raise ValueError("Job description cannot be empty.")
        if len(self.raw_text) > MAX_JOB_DESCRIPTION_CHARS:
            limit = MAX_JOB_DESCRIPTION_CHARS
            raise ValueError(f"Job description exceeds the {limit} character limit.")
        return self


class JobDescriptionUpdateRequest(BaseModel):
    title: str | None = None
    company: str | None = None
    raw_text: str | None = None

    @model_validator(mode="after")
    def _raw_text_acceptable(self) -> JobDescriptionUpdateRequest:
        if self.raw_text is not None:
            if not self.raw_text.strip():
                raise ValueError("Job description cannot be empty.")
            if len(self.raw_text) > MAX_JOB_DESCRIPTION_CHARS:
                limit = MAX_JOB_DESCRIPTION_CHARS
                raise ValueError(f"Job description exceeds the {limit} character limit.")
        return self


class JobDescriptionResponse(BaseModel):
    id: str
    title: str | None
    company: str | None
    raw_text: str
    resume_id: str | None = None
    created_at: str
    updated_at: str | None = None


class MatchResponse(BaseModel):
    id: str
    job_description_id: str
    resume_version_id: str
    score: int
    matched_skills: list[str]
    missing_skills: list[str]
    strengths: list[str]
    actions: list[MatchAction]
    model_version: str | None
    created_at: str


class MatchRunRequest(BaseModel):
    resume_id: str
    resume_version_id: str | None = None


class JobDescriptionMatchResponse(BaseModel):
    job_description: JobDescriptionResponse
    match: MatchResponse
