"""Job search endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel, model_validator


class JobSearchRequest(BaseModel):
    query: str
    location: str | None = None
    source: str | None = None
    page: int = 1
    limit: int = 20

    @model_validator(mode="after")
    def _validate_source(self) -> JobSearchRequest:
        allowed = {"technopark", "naukri", "linkedin", "indeed", "monster", "all", None}
        if self.source not in allowed:
            raise ValueError(f"source must be one of: {', '.join(s for s in allowed if s)}")
        return self


class JobSearchResult(BaseModel):
    id: str
    title: str
    company: str
    location: str
    source: str
    url: str
    description: str
    skills: list[str]
    posted_date: str | None = None
    salary_range: str | None = None
    match_score: float | None = None


class JobSearchResponse(BaseModel):
    results: list[JobSearchResult]
    total: int
    page: int
    has_more: bool


class SaveJobRequest(BaseModel):
    job_id: str
    job_title: str
    company: str
    source: str
    url: str
    match_score: float | None = None


class AlertPreferenceRequest(BaseModel):
    query: str
    location: str | None = None
    min_match_score: float = 0.0
    frequency: str = "daily"
    enabled: bool = True

    @model_validator(mode="after")
    def _validate_frequency(self) -> AlertPreferenceRequest:
        allowed = {"daily", "weekly", "instant"}
        if self.frequency not in allowed:
            raise ValueError(f"frequency must be one of: {', '.join(allowed)}")
        return self


class SavedJobResponse(BaseModel):
    id: str
    user_id: str
    job_id: str
    job_title: str
    company: str
    source: str
    url: str
    saved_at: str
    match_score: float | None = None


class JobAlertPreference(BaseModel):
    id: str
    user_id: str
    query: str
    location: str | None = None
    min_match_score: float
    frequency: str
    enabled: bool
    created_at: str
