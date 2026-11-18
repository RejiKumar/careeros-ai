"""JSearch adapter and JSearch->Adzuna fallback fixture tests.

httpx.MockTransport pins the request contract and normalisation without live
calls; stub providers pin the fallback and quota cool-down behaviour.
"""

from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest
from app.core.config import Settings
from app.integrations.job_search.adzuna import AdzunaJobSearchProvider
from app.integrations.job_search.fallback import FallbackJobSearchProvider, ProviderCooldown
from app.integrations.job_search.jsearch import JSearchJobSearchProvider
from app.integrations.job_search.provider import (
    JobSearchProvider,
    JobSearchProviderError,
    JobSearchQuotaError,
    build_job_search_provider,
)
from app.modules.job_search.schema import JobSearchResult

API_KEY = "test-rapidapi-key"


def _provider(
    handler: Callable[[httpx.Request], httpx.Response],
) -> tuple[JSearchJobSearchProvider, list[httpx.Request]]:
    captured: list[httpx.Request] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    provider = JSearchJobSearchProvider(
        api_key=API_KEY, country="in", transport=httpx.MockTransport(_handler)
    )
    return provider, captured


def _item(**overrides: object) -> dict:
    base: dict = {
        "job_id": "abc123==",
        "job_title": "Python Developer",
        "employer_name": "Acme Technologies",
        "job_publisher": "LinkedIn",
        "job_city": "Bengaluru",
        "job_state": "Karnataka",
        "job_country": "IN",
        "job_apply_link": "https://www.linkedin.com/jobs/view/1",
        "job_description": "  Build APIs with FastAPI.  ",
        "job_posted_at_datetime_utc": "2026-11-17T08:30:00.000Z",
        "job_min_salary": 1200000,
        "job_max_salary": 1800000,
        "job_salary_currency": "INR",
        "job_salary_period": "YEAR",
        "job_required_skills": ["Python", "FastAPI", 7],
    }
    base.update(overrides)
    return base


def _ok(items: list[dict]) -> httpx.Response:
    return httpx.Response(200, json={"status": "OK", "data": items})


def test_request_contract_is_pinned() -> None:
    provider, captured = _provider(lambda r: _ok([_item()]))

    provider.search("python developer", "Bengaluru", None, page=2, limit=20)

    request = captured[0]
    assert request.method == "GET"
    assert request.url.host == "jsearch.p.rapidapi.com"
    assert request.url.path == "/search"
    params = dict(request.url.params)
    assert params == {
        "query": "python developer in Bengaluru",
        "page": "2",
        "num_pages": "1",
        "country": "in",
        "date_posted": "all",
    }
    assert request.headers["X-RapidAPI-Key"] == API_KEY
    assert request.headers["X-RapidAPI-Host"] == "jsearch.p.rapidapi.com"
    assert API_KEY not in str(request.url)


def test_empty_query_defaults_and_no_location() -> None:
    provider, captured = _provider(lambda r: _ok([]))

    provider.search("  ", None, None, page=0, limit=5)

    params = dict(captured[0].url.params)
    assert params["query"] == "software"
    assert params["page"] == "1"


def test_normalises_results() -> None:
    provider, _ = _provider(lambda r: _ok([_item()]))

    [result] = provider.search("python", None, None, page=1, limit=5)

    assert result.id == "abc123=="
    assert result.title == "Python Developer"
    assert result.company == "Acme Technologies"
    assert result.location == "Bengaluru, Karnataka, IN"
    assert result.source == "LinkedIn"
    assert result.url == "https://www.linkedin.com/jobs/view/1"
    assert result.description == "Build APIs with FastAPI."
    assert result.skills == ["Python", "FastAPI"]
    assert result.posted_date == "2026-11-17"
    assert result.salary_range == "1200000-1800000 INR per year (stated)"
    assert result.match_score is None


def test_tolerates_malformed_items_and_caps_to_limit() -> None:
    items = [
        {"job_id": None, "job_title": 5, "job_is_remote": True, "job_min_salary": "x"},
        "not-a-dict",
        _item(),
        _item(),
    ]
    provider, _ = _provider(lambda r: _ok(items))

    results = provider.search("python", None, None, page=1, limit=2)

    assert len(results) == 2
    assert results[0].title == "Untitled role"
    assert results[0].id == ""
    assert results[0].location == "Remote"
    assert results[0].source == "jsearch"
    assert results[0].salary_range is None
    assert results[0].posted_date is None


@pytest.mark.parametrize("status", [402, 403, 429])
def test_quota_statuses_raise_quota_error(status: int) -> None:
    provider, _ = _provider(lambda r: httpx.Response(status, json={"message": "quota"}))

    with pytest.raises(JobSearchQuotaError):
        provider.search("python", None, None, page=1, limit=5)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, json={"error": "down"}),
        httpx.Response(200, text="<html>not json</html>"),
        httpx.Response(200, json={"status": "ERROR"}),
    ],
)
def test_other_failures_raise_provider_error(response: httpx.Response) -> None:
    provider, _ = _provider(lambda r: response)

    with pytest.raises(JobSearchProviderError) as exc_info:
        provider.search("python", None, None, page=1, limit=5)
    assert not isinstance(exc_info.value, JobSearchQuotaError)


class _Stub(JobSearchProvider):
    def __init__(self, outcome: list[JobSearchResult] | Exception) -> None:
        self.outcome = outcome
        self.calls = 0

    def search(
        self, query: str, location: str | None, source: str | None, page: int, limit: int
    ) -> list[JobSearchResult]:
        self.calls += 1
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def _result(source: str) -> JobSearchResult:
    return JobSearchResult(
        id=source,
        title="Role",
        company="Co",
        location="",
        source=source,
        url="",
        description="",
        skills=[],
    )


class _Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def _fallback(
    primary: _Stub, secondary: _Stub, clock: _Clock | None = None
) -> FallbackJobSearchProvider:
    return FallbackJobSearchProvider(
        primary,
        secondary,
        cooldown=ProviderCooldown(),
        cooldown_seconds=60,
        clock=clock or _Clock(),
    )


def test_fallback_prefers_primary_results() -> None:
    primary, secondary = _Stub([_result("LinkedIn")]), _Stub([_result("adzuna")])

    results = _fallback(primary, secondary).search("q", None, None, 1, 10)

    assert [r.source for r in results] == ["LinkedIn"]
    assert secondary.calls == 0


@pytest.mark.parametrize("outcome", [[], JobSearchProviderError()])
def test_fallback_used_on_empty_or_error(outcome: list | Exception) -> None:
    primary, secondary = _Stub(outcome), _Stub([_result("adzuna")])

    results = _fallback(primary, secondary).search("q", None, None, 1, 10)

    assert [r.source for r in results] == ["adzuna"]


def test_quota_error_skips_primary_until_cooldown_ends() -> None:
    clock = _Clock()
    primary, secondary = _Stub(JobSearchQuotaError()), _Stub([_result("adzuna")])
    provider = _fallback(primary, secondary, clock)

    provider.search("q", None, None, 1, 10)
    provider.search("q", None, None, 1, 10)
    assert primary.calls == 1
    assert secondary.calls == 2

    clock.now += 61
    provider.search("q", None, None, 1, 10)
    assert primary.calls == 2


def test_fallback_error_propagates() -> None:
    primary, secondary = _Stub(JobSearchQuotaError()), _Stub(JobSearchProviderError())

    with pytest.raises(JobSearchProviderError):
        _fallback(primary, secondary).search("q", None, None, 1, 10)


def test_build_uses_jsearch_with_adzuna_fallback() -> None:
    provider = build_job_search_provider(
        Settings(jsearch_api_key="k", adzuna_app_id="id", adzuna_app_key="key")
    )

    assert isinstance(provider, FallbackJobSearchProvider)
    assert isinstance(provider.primary, JSearchJobSearchProvider)
    assert isinstance(provider.fallback, AdzunaJobSearchProvider)


def test_build_uses_jsearch_alone_without_adzuna() -> None:
    provider = build_job_search_provider(Settings(jsearch_api_key="k"))

    assert isinstance(provider, JSearchJobSearchProvider)


def test_default_countries_are_india() -> None:
    settings = Settings()

    assert settings.jsearch_country == "in"
    assert settings.adzuna_country == "in"
