"""Company deep dive endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class CompanySearchRequest(BaseModel):
    query: str
    location: str | None = None


class CompanyProfileResponse(BaseModel):
    id: str
    name: str
    location: str | None
    tech_stack: list[str]
    team_size: str | None = None
    industry: str | None = None
    description: str | None = None
    culture_signals: list[str] | None = None
    funding_stage: str | None = None
    growth_indicator: str | None = None
    recent_job_count: int | None = None
    logo_url: str | None = None


class CompanyJob(BaseModel):
    id: str
    title: str
    location: str
    url: str
    posted_date: str | None = None


class CompanyJobsResponse(BaseModel):
    company_name: str
    jobs: list[CompanyJob]
    total: int


class SaveCompanyRequest(BaseModel):
    company_name: str
    notes: str | None = None


class SavedCompanyResponse(BaseModel):
    id: str
    user_id: str
    company_name: str
    notes: str | None = None
    saved_at: str
