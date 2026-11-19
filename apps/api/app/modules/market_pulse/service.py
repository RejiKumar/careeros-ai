"""Market Pulse use cases: labour-market intelligence from real job postings.

Every number is a live job-board count (postings published in the last 30
days per skill, and the hiring leaderboard). Nothing is estimated: growth
rates and salary ranges are deliberately not reported because the source
cannot support them honestly (expired postings inflate any "growth" measure,
and its salary histogram is too coarse for a range). When the source cannot be
reached the use case fails with a clear error instead of returning placeholder
data.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import status

from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.market_data.provider import (
    MarketDataProvider,
    MarketDataUnavailableError,
    SkillCount,
)

from .schema import (
    MarketPulseResponse,
    SkillDemandItem,
    SkillTrendResponse,
    TopCompany,
)

# Skills tracked on the dashboard (one cached source call each).
TRACKED_SKILLS = ["Python", "React", "TypeScript", "Java", "AWS", "Docker"]
TOP_COMPANY_ROLE = "software engineer"
TOP_COMPANY_LIMIT = 5
PERIOD = "30d"
RECOMMENDED_LIMIT = 5


class MarketDataUnavailableAppError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="market_data_unavailable",
            message="Live market data is temporarily unavailable. Please try again later.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class MarketPulseService:
    def __init__(self, provider: MarketDataProvider) -> None:
        self._provider = provider

    def get_market_pulse(
        self,
        actor: CurrentActor,
        *,
        location: str | None = None,
        role: str | None = None,
    ) -> MarketPulseResponse:
        location = (location or "").strip() or None
        try:
            counts = self._provider.skill_counts(TRACKED_SKILLS, location)
            companies = self._provider.top_companies(
                (role or "").strip() or TOP_COMPANY_ROLE, location, TOP_COMPANY_LIMIT
            )
        except MarketDataUnavailableError as exc:
            raise MarketDataUnavailableAppError() from exc

        return MarketPulseResponse(
            skill_demands=_skill_demands(counts),
            salary_ranges=[],
            top_companies=[
                TopCompany(name=c.name, job_count=c.job_count, tech_stack=[], location=location)
                for c in companies
            ],
            generated_at=datetime.now(UTC).isoformat(),
        )

    def get_skill_trends(
        self,
        actor: CurrentActor,
        *,
        period: str,
        location: str | None = None,
    ) -> SkillTrendResponse:
        location = (location or "").strip() or None
        try:
            counts = self._provider.skill_counts(TRACKED_SKILLS, location)
        except MarketDataUnavailableError as exc:
            raise MarketDataUnavailableAppError() from exc

        recommended = [
            count.skill
            for count in sorted(counts, key=lambda c: c.last_30_days, reverse=True)
            if count.last_30_days > 0
        ][:RECOMMENDED_LIMIT]
        return SkillTrendResponse(
            trends=[],
            recommended_skills=recommended,
            generated_at=datetime.now(UTC).isoformat(),
        )


def _skill_demands(counts: list[SkillCount]) -> list[SkillDemandItem]:
    busiest = max((c.last_30_days for c in counts), default=0)
    items = [
        SkillDemandItem(
            skill=count.skill,
            demand_score=round(count.last_30_days / busiest * 100, 1) if busiest else 0.0,
            change_percent=None,
            period=PERIOD,
            job_count=count.last_30_days,
        )
        for count in counts
    ]
    return sorted(items, key=lambda item: item.job_count, reverse=True)
