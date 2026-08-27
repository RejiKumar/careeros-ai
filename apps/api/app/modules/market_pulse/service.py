"""Market Pulse use cases: aggregated market intelligence dashboard.

Returns mock data initially — real aggregation pipelines will replace stubs.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import status

from app.ai.provider import CareerAiProvider
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import MarketPulseRepository
from .schema import (
    MarketPulseResponse,
    SalaryRange,
    SkillDemandItem,
    SkillTrendItem,
    SkillTrendResponse,
    TopCompany,
)


class MarketPulseError(AppError):
    def __init__(self, *, message: str = "Market data could not be loaded.") -> None:
        super().__init__(
            code="market_pulse_error",
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class MarketPulseService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._repository = MarketPulseRepository(service_client)

    def get_market_pulse(
        self,
        actor: CurrentActor,
        *,
        location: str | None = None,
        role: str | None = None,
    ) -> MarketPulseResponse:
        now = datetime.now(UTC).isoformat()

        # TODO: replace with real aggregation from repository + provider
        skill_demands = [
            SkillDemandItem(
                skill="React", demand_score=92.5,
                change_percent=12.3, period="6m", job_count=1840,
            ),
            SkillDemandItem(
                skill="Python", demand_score=88.1,
                change_percent=8.7, period="6m", job_count=2150,
            ),
            SkillDemandItem(
                skill="TypeScript", demand_score=85.4,
                change_percent=15.1, period="3m", job_count=1620,
            ),
            SkillDemandItem(
                skill="Node.js", demand_score=79.8,
                change_percent=5.2, period="1y", job_count=1380,
            ),
            SkillDemandItem(
                skill="AWS", demand_score=82.0,
                change_percent=10.4, period="6m", job_count=1590,
            ),
        ]

        salary_ranges = [
            SalaryRange(
                role="Software Engineer", location="Bangalore",
                min_salary=600000, max_salary=1800000,
                median_salary=1100000, experience_level="mid",
            ),
            SalaryRange(
                role="Software Engineer", location="Remote",
                min_salary=500000, max_salary=1600000,
                median_salary=950000, experience_level="mid",
            ),
            SalaryRange(
                role="Data Scientist", location="Bangalore",
                min_salary=800000, max_salary=2200000,
                median_salary=1400000, experience_level="senior",
            ),
        ]

        top_companies = [
            TopCompany(
                name="TCS", job_count=342,
                tech_stack=["Java", "React", "AWS"],
                location="Bangalore",
            ),
            TopCompany(
                name="Infosys", job_count=298,
                tech_stack=["Python", "Angular", "Azure"],
                location="Hyderabad",
            ),
            TopCompany(
                name="Flipkart", job_count=156,
                tech_stack=["Kotlin", "React", "GCP"],
                location="Bangalore",
            ),
        ]

        return MarketPulseResponse(
            skill_demands=skill_demands,
            salary_ranges=salary_ranges,
            top_companies=top_companies,
            generated_at=now,
        )

    def get_skill_trends(
        self,
        actor: CurrentActor,
        *,
        period: str,
        location: str | None = None,
    ) -> SkillTrendResponse:
        now = datetime.now(UTC).isoformat()

        # TODO: replace with real trend analysis from repository + provider
        trends = [
            SkillTrendItem(
                skill="React", direction="rising",
                change_percent=12.3, period=period,
            ),
            SkillTrendItem(
                skill="Python", direction="rising",
                change_percent=8.7, period=period,
            ),
            SkillTrendItem(
                skill="Java", direction="stable",
                change_percent=1.2, period=period,
            ),
            SkillTrendItem(
                skill="PHP", direction="declining",
                change_percent=-4.5, period=period,
            ),
            SkillTrendItem(
                skill="jQuery", direction="declining",
                change_percent=-11.2, period=period,
            ),
        ]

        recommended_skills = ["React", "Python", "TypeScript", "AWS", "Docker"]

        return SkillTrendResponse(
            trends=trends,
            recommended_skills=recommended_skills,
            generated_at=now,
        )
