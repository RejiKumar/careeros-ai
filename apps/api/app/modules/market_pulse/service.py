"""Market Pulse use cases: labour-market intelligence from real job postings.

Every number comes from live job-board statistics (job counts, salary
distributions and the hiring leaderboard). When the source cannot be reached
the use case fails with a clear error instead of returning placeholder data.
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
    SalaryRange,
    SkillDemandItem,
    SkillTrendItem,
    SkillTrendResponse,
    TopCompany,
)

# Skills tracked on the dashboard. Each costs two cached source calls.
TRACKED_SKILLS = ["Python", "React", "TypeScript", "Java", "AWS", "Docker"]
SALARY_ROLES = ["Software Engineer", "Data Scientist"]
TOP_COMPANY_ROLE = "software engineer"
TOP_COMPANY_LIMIT = 5
PERIOD = "30d"
# A skill is "rising" or "declining" only beyond this posting-count change.
TREND_THRESHOLD_PERCENT = 5.0


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
        roles = [role.strip()] if role and role.strip() else SALARY_ROLES
        try:
            counts = self._provider.skill_counts(TRACKED_SKILLS, location)
            salary_ranges: list[SalaryRange] = []
            for salary_role in roles:
                stats = self._provider.salary_stats(salary_role, location)
                if stats is None:
                    continue
                salary_ranges.append(
                    SalaryRange(
                        role=salary_role,
                        location=location or "All locations",
                        min_salary=stats.min_salary,
                        max_salary=stats.max_salary,
                        median_salary=stats.median_salary,
                        currency=stats.currency,
                    )
                )
            companies = self._provider.top_companies(
                role or TOP_COMPANY_ROLE, location, TOP_COMPANY_LIMIT
            )
        except MarketDataUnavailableError as exc:
            raise MarketDataUnavailableAppError() from exc

        return MarketPulseResponse(
            skill_demands=_skill_demands(counts),
            salary_ranges=salary_ranges,
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

        trends = [
            SkillTrendItem(
                skill=count.skill,
                direction=_direction(change),
                change_percent=change,
                period=PERIOD,
            )
            for count in counts
            if (change := _change_percent(count)) is not None
        ]
        recommended = [
            count.skill
            for count in sorted(counts, key=lambda c: c.last_30_days, reverse=True)
            if count.last_30_days > 0
        ][:5]
        return SkillTrendResponse(
            trends=trends,
            recommended_skills=recommended,
            generated_at=datetime.now(UTC).isoformat(),
        )


def _change_percent(count: SkillCount) -> float | None:
    """Posting-count change vs the previous 30 days; None when there is no baseline."""
    if count.previous_30_days <= 0:
        return None
    return round((count.last_30_days - count.previous_30_days) / count.previous_30_days * 100, 1)


def _direction(change: float) -> str:
    if change > TREND_THRESHOLD_PERCENT:
        return "rising"
    if change < -TREND_THRESHOLD_PERCENT:
        return "declining"
    return "stable"


def _skill_demands(counts: list[SkillCount]) -> list[SkillDemandItem]:
    busiest = max((c.last_30_days for c in counts), default=0)
    items = [
        SkillDemandItem(
            skill=count.skill,
            demand_score=round(count.last_30_days / busiest * 100, 1) if busiest else 0.0,
            change_percent=_change_percent(count),
            period=PERIOD,
            job_count=count.last_30_days,
        )
        for count in counts
    ]
    return sorted(items, key=lambda item: item.job_count, reverse=True)
