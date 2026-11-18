"""JSearch job search adapter (Google for Jobs via RapidAPI).

Returns near real-time listings aggregated from LinkedIn, Indeed, Naukri,
Glassdoor and other boards. Provider types stay inside this module; results are
untrusted external data normalised into ``JobSearchResult``. The API key is
read from settings and never logged.

The free plan has a small hard monthly cap, so each search costs exactly one
request (``num_pages=1``, 10 results) and quota exhaustion is reported as
``JobSearchQuotaError`` so callers can fall back to another provider.
"""

from __future__ import annotations

import logging

import httpx

from app.modules.job_search.schema import JobSearchResult

from .provider import JobSearchProvider, JobSearchProviderError, JobSearchQuotaError

logger = logging.getLogger(__name__)

_HOST = "jsearch.p.rapidapi.com"
_BASE_URL = f"https://{_HOST}"
_PAGE_SIZE = 10
_QUOTA_STATUSES = {402, 403, 429}


class JSearchJobSearchProvider(JobSearchProvider):
    def __init__(
        self,
        *,
        api_key: str,
        country: str = "in",
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
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
        what = query.strip() or "software"
        text = f"{what} in {location.strip()}" if location and location.strip() else what
        params = {
            "query": text,
            "page": str(max(1, page)),
            "num_pages": "1",
            "country": self._country,
            "date_posted": "all",
        }
        headers = {"X-RapidAPI-Key": self._api_key, "X-RapidAPI-Host": _HOST}
        try:
            with httpx.Client(
                base_url=_BASE_URL, timeout=20.0, transport=self._transport
            ) as client:
                resp = client.get("/search", params=params, headers=headers)
                if resp.status_code in _QUOTA_STATUSES:
                    logger.warning("[JSearch] quota or plan limit hit (HTTP %s)", resp.status_code)
                    raise JobSearchQuotaError
                resp.raise_for_status()
                payload = resp.json()
        except JobSearchQuotaError:
            raise
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("[JSearch] search failed: %s", type(exc).__name__)
            raise JobSearchProviderError from exc

        items = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(items, list):
            raise JobSearchProviderError
        cap = max(1, min(limit, _PAGE_SIZE))
        valid = [item for item in items if isinstance(item, dict)]
        return [_normalise(item) for item in valid[:cap]]


def _normalise(item: dict) -> JobSearchResult:
    publisher = _text(item.get("job_publisher"))
    skills = item.get("job_required_skills")
    return JobSearchResult(
        id=_text(item.get("job_id")),
        title=_text(item.get("job_title")) or "Untitled role",
        company=_text(item.get("employer_name")),
        location=_location(item),
        source=publisher or "jsearch",
        url=_text(item.get("job_apply_link")) or _text(item.get("job_google_link")),
        description=_text(item.get("job_description")).strip()[:800],
        skills=[s for s in skills if isinstance(s, str)][:15] if isinstance(skills, list) else [],
        posted_date=_text(item.get("job_posted_at_datetime_utc"))[:10] or None,
        salary_range=_salary_range(item),
        match_score=None,
    )


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _location(item: dict) -> str:
    if item.get("job_is_remote") is True and not item.get("job_city"):
        return "Remote"
    parts = [_text(item.get(key)) for key in ("job_city", "job_state", "job_country")]
    return ", ".join(p for p in parts if p)


def _salary_range(item: dict) -> str | None:
    low = _opt_int(item.get("job_min_salary"))
    high = _opt_int(item.get("job_max_salary"))
    if low is None and high is None:
        return None
    low = high if low is None else low
    high = low if high is None else high
    currency = _text(item.get("job_salary_currency"))
    period = _text(item.get("job_salary_period")).lower()
    suffix = f" {currency}" if currency else ""
    suffix += f" per {period}" if period else ""
    return f"{low}-{high}{suffix} (stated)"


def _opt_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        return int(value) if value is not None else None  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
