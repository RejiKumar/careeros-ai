"""Adzuna job search adapter (REST API).

Provider types stay inside this module. Live results are untrusted external
data; they are normalised into the shared ``JobSearchResult`` schema and never
treated as ground truth. API credentials are read from settings and never
logged.
"""

from __future__ import annotations

import logging

import httpx

from app.modules.job_search.schema import JobSearchResult

from .provider import JobSearchProvider, JobSearchProviderError

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.adzuna.com/v1/api/jobs"


class AdzunaJobSearchProvider(JobSearchProvider):
    def __init__(
        self,
        *,
        app_id: str,
        app_key: str,
        country: str = "gb",
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._app_id = app_id
        self._app_key = app_key
        self._country = country
        self._transport = transport

    def search(
        self,
        query: str,
        location: str | None,
        source: str | None,
        page: int,
        limit: int,
    ) -> list[JobSearchResult]:
        results_per_page = max(1, min(limit, 50))
        params = {
            "app_id": self._app_id,
            "app_key": self._app_key,
            "results_per_page": results_per_page,
            "what": query or "software",
            "content-type": "application/json",
        }
        if location:
            params["where"] = location

        url = f"{_BASE_URL}/{self._country}/search/{page}"
        try:
            with httpx.Client(timeout=15.0, transport=self._transport) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                payload = resp.json()
        except (httpx.HTTPError, ValueError) as exc:  # noqa: PERF203
            logger.warning("[Adzuna] search failed for query=%r: %s", query, exc)
            raise JobSearchProviderError from exc

        return [_normalise(item) for item in payload.get("results", [])]


def _normalise(item: dict) -> JobSearchResult:
    title = item.get("title") or "Untitled role"
    company = item.get("company") or {}
    company_name = company.get("display_name") or "" if isinstance(company, dict) else ""

    location = ""
    loc = item.get("location") or {}
    if isinstance(loc, dict):
        location = loc.get("display_name") or ""

    salary_range = _salary_range(item)
    return JobSearchResult(
        id=str(item.get("id") or ""),
        title=title,
        company=company_name,
        location=location,
        source="adzuna",
        url=item.get("redirect_url") or "",
        description=(item.get("description") or "").strip()[:800],
        skills=[],
        posted_date=_posted_date(item),
        salary_range=salary_range,
        match_score=None,
    )


def _salary_range(item: dict) -> str | None:
    salary_min = _opt_int(item.get("salary_min"))
    salary_max = _opt_int(item.get("salary_max"))
    predicted = item.get("salary_is_predicted")
    if salary_min is None and salary_max is None:
        return None
    if salary_min is None:
        salary_min = salary_max
    if salary_max is None:
        salary_max = salary_min
    label = "estimated" if predicted else "stated"
    return f"{salary_min}-{salary_max} ({label})"


def _opt_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _posted_date(item: dict) -> str | None:
    created = item.get("created")
    if created and isinstance(created, str):
        return created[:10]
    return None
