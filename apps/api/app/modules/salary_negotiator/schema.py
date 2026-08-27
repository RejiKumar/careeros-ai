"""Salary negotiation endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class SalaryRequest(BaseModel):
    role: str
    location: str
    experience_years: int | None = None
    skills: list[str] | None = None
    company: str | None = None


class SalaryRangeResponse(BaseModel):
    role: str
    location: str
    min_salary: float
    max_salary: float
    median_salary: float
    currency: str = "INR"
    experience_level: str
    confidence: float


class NegotiationScript(BaseModel):
    opening: str
    justification_points: list[str]
    handling_objections: list[str]
    closing: str


class NegotiationResponse(BaseModel):
    salary_range: SalaryRangeResponse
    script: NegotiationScript
    generated_at: str


class BenefitsComparison(BaseModel):
    item: str
    typical: str
    negotiable: bool


class BenefitsComparisonResponse(BaseModel):
    benefits: list[BenefitsComparison]
    generated_at: str
