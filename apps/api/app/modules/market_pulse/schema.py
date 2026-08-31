"""Market Pulse Dashboard endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel, model_validator


class SkillDemandItem(BaseModel):
    skill: str
    demand_score: float
    change_percent: float
    period: str
    job_count: int

    @model_validator(mode="after")
    def _period_valid(self) -> SkillDemandItem:
        if self.period not in ("3m", "6m", "1y"):
            raise ValueError("period must be one of '3m', '6m', '1y'.")
        return self


class SalaryRange(BaseModel):
    role: str
    location: str
    min_salary: float
    max_salary: float
    median_salary: float
    currency: str = "INR"
    experience_level: str | None = None

    @model_validator(mode="after")
    def _salary_order(self) -> SalaryRange:
        if self.min_salary > self.median_salary:
            raise ValueError("min_salary must be <= median_salary.")
        if self.median_salary > self.max_salary:
            raise ValueError("median_salary must be <= max_salary.")
        return self


class TopCompany(BaseModel):
    name: str
    job_count: int
    tech_stack: list[str]
    location: str | None = None
    logo_url: str | None = None


class MarketPulseResponse(BaseModel):
    skill_demands: list[SkillDemandItem]
    salary_ranges: list[SalaryRange]
    top_companies: list[TopCompany]
    generated_at: str


class SkillTrendItem(BaseModel):
    skill: str
    direction: str
    change_percent: float
    period: str

    @model_validator(mode="after")
    def _direction_valid(self) -> SkillTrendItem:
        if self.direction not in ("rising", "stable", "declining"):
            raise ValueError("direction must be one of 'rising', 'stable', 'declining'.")
        return self


class SkillTrendResponse(BaseModel):
    trends: list[SkillTrendItem]
    recommended_skills: list[str]
    generated_at: str
