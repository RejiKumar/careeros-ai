"""Application tracker endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class ApplicationRequest(BaseModel):
    job_id: str | None = None
    job_title: str
    company: str
    status: str = "applied"
    notes: str | None = None
    url: str | None = None
    applied_at: str | None = None
    interview_date: str | None = None
    follow_up_date: str | None = None


class ApplicationUpdateRequest(BaseModel):
    status: str | None = None
    notes: str | None = None
    interview_date: str | None = None
    follow_up_date: str | None = None


class ApplicationResponse(BaseModel):
    id: str
    user_id: str | None = None
    job_id: str | None = None
    job_title: str
    company: str
    status: str
    notes: str | None = None
    url: str | None = None
    applied_at: str | None = None
    interview_date: str | None = None
    follow_up_date: str | None = None
    created_at: str
    updated_at: str | None = None


class ApplicationStatsResponse(BaseModel):
    total: int
    applied: int
    interviewing: int
    offered: int
    rejected: int
    response_rate: float
    avg_response_days: float | None = None

