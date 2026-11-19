"""Adzuna labour-market statistics (REST API).

Uses two real endpoints: ``search`` (the ``count`` of postings published in the
last 30 days that mention a skill) and ``top_companies`` (hiring leaderboard).
Credentials are read from settings and never logged. Results are cached in
memory because the free plan has a small daily quota, and one transient
failure (rate limit, 5xx, timeout) is retried before giving up.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

import httpx

from .provider import (
    CompanyCount,
    MarketDataProvider,
    MarketDataUnavailableError,
    SkillCount,
)

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.adzuna.com/v1/api/jobs"
_CACHE_TTL_SECONDS = 6 * 60 * 60
_MAX_WORKERS = 3
_RETRY_DELAY_SECONDS = 1.5
_TRANSIENT_STATUSES = frozenset({429, 500, 502, 503, 504})

_cache: dict[tuple, tuple[float, object]] = {}
_cache_lock = threading.Lock()


def clear_cache() -> None:
    """Drop cached statistics (used by tests)."""
    with _cache_lock:
        _cache.clear()


def _cached[T](key: tuple, load: Callable[[], T]) -> T:
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(key)
        if hit is not None and now - hit[0] < _CACHE_TTL_SECONDS:
            return hit[1]  # type: ignore[return-value]
    value = load()
    with _cache_lock:
        _cache[key] = (time.monotonic(), value)
    return value


class AdzunaMarketData(MarketDataProvider):
    def __init__(
        self,
        *,
        app_id: str,
        app_key: str,
        country: str = "in",
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._app_id = app_id
        self._app_key = app_key
        self._country = country.lower()
        self._transport = transport
        self._sleep = sleep

    # -- public API ------------------------------------------------------

    def skill_counts(self, skills: list[str], location: str | None) -> list[SkillCount]:
        key = ("skills", self._country, location or "", tuple(skills))
        return _cached(key, lambda: self._load_skill_counts(skills, location))

    def top_companies(self, role: str, location: str | None, limit: int) -> list[CompanyCount]:
        key = ("companies", self._country, location or "", role, limit)
        return _cached(key, lambda: self._load_top_companies(role, location, limit))

    # -- loaders ---------------------------------------------------------

    def _load_skill_counts(self, skills: list[str], location: str | None) -> list[SkillCount]:
        def count_for(skill: str) -> SkillCount:
            return SkillCount(skill=skill, last_30_days=self._posting_count(skill, location))

        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            return list(pool.map(count_for, skills))

    def _posting_count(self, what: str, location: str | None) -> int:
        params: dict[str, str | int] = {
            "what": what,
            "results_per_page": 1,
            "max_days_old": 30,
        }
        if location:
            params["where"] = location
        payload = self._get(f"{self._country}/search/1", params)
        count = payload.get("count")
        if not isinstance(count, int) or count < 0:
            raise MarketDataUnavailableError("Unexpected Adzuna search response.")
        return count

    def _load_top_companies(
        self, role: str, location: str | None, limit: int
    ) -> list[CompanyCount]:
        params: dict[str, str | int] = {"what": role}
        if location:
            params["where"] = location
        payload = self._get(f"{self._country}/top_companies", params)
        leaderboard = payload.get("leaderboard")
        if not isinstance(leaderboard, list):
            raise MarketDataUnavailableError("Unexpected Adzuna leaderboard response.")
        companies: list[CompanyCount] = []
        for item in leaderboard:
            if not isinstance(item, dict):
                continue
            name = item.get("canonical_name") or item.get("display_name")
            count = item.get("count")
            if isinstance(name, str) and name and isinstance(count, int):
                companies.append(CompanyCount(name=name, job_count=count))
        return companies[:limit]

    # -- transport -------------------------------------------------------

    def _get(self, path: str, params: dict[str, str | int]) -> dict:
        query = {
            **params,
            "app_id": self._app_id,
            "app_key": self._app_key,
            "content-type": "application/json",
        }
        last: Exception | None = None
        for attempt in range(2):
            try:
                with httpx.Client(timeout=10.0, transport=self._transport) as client:
                    response = client.get(f"{_BASE_URL}/{path}", params=query)
                if response.status_code in _TRANSIENT_STATUSES and attempt == 0:
                    logger.warning("[Adzuna] %s on %s; retrying", response.status_code, path)
                    self._sleep(_RETRY_DELAY_SECONDS)
                    continue
                response.raise_for_status()
                payload = response.json()
            except httpx.TimeoutException as exc:
                last = exc
                logger.warning("[Adzuna] timeout on %s (attempt %d)", path, attempt + 1)
                self._sleep(_RETRY_DELAY_SECONDS)
                continue
            except httpx.HTTPStatusError as exc:
                # Log the status only: the request URL carries the API credentials.
                logger.warning("[Adzuna] HTTP %s on %s", exc.response.status_code, path)
                raise MarketDataUnavailableError("Adzuna request failed.") from exc
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("[Adzuna] request failed on %s: %s", path, type(exc).__name__)
                raise MarketDataUnavailableError("Adzuna request failed.") from exc
            if not isinstance(payload, dict):
                raise MarketDataUnavailableError("Unexpected Adzuna response.")
            return payload
        raise MarketDataUnavailableError("Adzuna request failed.") from last
