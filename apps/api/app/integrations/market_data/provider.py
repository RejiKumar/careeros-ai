"""Provider-neutral live labour-market data interface.

Use-case code depends only on ``MarketDataProvider`` and the small result
types below. The concrete source (Adzuna) stays inside its own module. All
values come from real job postings; nothing is estimated or invented, and a
failure is reported as ``MarketDataUnavailableError`` rather than replaced by
placeholder numbers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings


class MarketDataUnavailableError(Exception):
    """Live market data could not be fetched (not configured, quota or network)."""


@dataclass(frozen=True)
class SkillCount:
    """Postings mentioning a skill that were published in the last 30 days."""

    skill: str
    last_30_days: int


@dataclass(frozen=True)
class CompanyCount:
    """A company and how many postings it currently has."""

    name: str
    job_count: int


class MarketDataProvider:
    """Live labour-market statistics."""

    def skill_counts(self, skills: list[str], location: str | None) -> list[SkillCount]:
        raise NotImplementedError

    def top_companies(self, role: str, location: str | None, limit: int) -> list[CompanyCount]:
        raise NotImplementedError


class UnconfiguredMarketData(MarketDataProvider):
    """Used when no market data source is configured: always reports unavailable."""

    def _unavailable(self) -> MarketDataUnavailableError:
        return MarketDataUnavailableError("No market data source is configured.")

    def skill_counts(self, skills: list[str], location: str | None) -> list[SkillCount]:
        raise self._unavailable()

    def top_companies(self, role: str, location: str | None, limit: int) -> list[CompanyCount]:
        raise self._unavailable()


def build_market_data_provider(settings: Settings) -> MarketDataProvider:
    if settings.adzuna_app_id and settings.adzuna_app_key:
        from .adzuna import AdzunaMarketData

        return AdzunaMarketData(
            app_id=settings.adzuna_app_id,
            app_key=settings.adzuna_app_key,
            country=settings.adzuna_country,
        )
    return UnconfiguredMarketData()


def get_market_data_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> MarketDataProvider:
    return build_market_data_provider(settings)
