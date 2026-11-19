"""Company deep dive API tests with a fake job search provider."""

from __future__ import annotations

import pytest
from app.core.config import Settings
from app.integrations.job_search.provider import (
    JobSearchProvider,
    JobSearchProviderError,
    get_job_search_provider,
)
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from app.modules.company_deep_dive.service import clear_cache
from app.modules.job_search.schema import JobSearchResult
from fastapi.testclient import TestClient

from .fakes import FakeClients

_AUTH = {"Authorization": "Bearer good-token"}


def _job(
    job_id: str,
    company: str,
    *,
    title: str = "Backend Engineer",
    location: str = "Bengaluru, IN",
    description: str = "",
    skills: list[str] | None = None,
) -> JobSearchResult:
    return JobSearchResult(
        id=job_id,
        title=title,
        company=company,
        location=location,
        source="LinkedIn",
        url=f"https://jobs.example/{job_id}",
        description=description,
        skills=skills or [],
        posted_date="2026-11-18",
        salary_range=None,
        match_score=None,
    )


class FakeJobSearch(JobSearchProvider):
    def __init__(self, results: list[JobSearchResult] | None = None, *, fail: bool = False) -> None:
        self._results = results or []
        self._fail = fail
        self.queries: list[str] = []

    def search(self, query, location, source, page, limit):  # type: ignore[no-untyped-def]
        self.queries.append(query)
        if self._fail:
            raise JobSearchProviderError
        return list(self._results)


RESULTS = [
    _job("1", "Acme Corp", description="Build services in Python and FastAPI on AWS."),
    _job("2", "Acme Corp", title="Data Engineer", description="Python, Spark and Kafka."),
    _job("3", "Acme Corp", location="Remote", skills=["Docker"]),
    _job("4", "Other Ltd", description="Java and Spring"),
]


@pytest.fixture(autouse=True)
def _fresh_cache() -> None:
    clear_cache()


def _make(provider: FakeJobSearch) -> TestClient:
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: FakeClients()
    app.dependency_overrides[get_job_search_provider] = lambda: provider
    return TestClient(app)


def _search(client: TestClient, query: str) -> list[dict]:
    response = client.post(
        f"{API_V1_PREFIX}/companies/search",
        json={"query": query, "location": None},
        headers=_AUTH,
    )
    assert response.status_code == 200
    return response.json()


def test_search_builds_company_profiles_from_real_postings() -> None:
    client = _make(FakeJobSearch(RESULTS))

    [acme] = _search(client, "acme")

    assert acme["name"] == "Acme Corp"
    assert acme["recent_job_count"] == 3
    assert acme["location"] == "Bengaluru, IN"
    assert set(acme["tech_stack"]) >= {"Python", "FastAPI", "AWS", "Spark", "Kafka", "Docker"}
    # Facts no job source provides stay empty instead of being invented.
    assert acme["team_size"] is None
    assert acme["culture_signals"] is None
    assert acme["funding_stage"] is None


def test_search_ignores_postings_from_other_companies() -> None:
    client = _make(FakeJobSearch(RESULTS))

    assert _search(client, "nonexistent") == []


def test_profile_and_jobs_use_the_company_id_from_search() -> None:
    client = _make(FakeJobSearch(RESULTS))
    [acme] = _search(client, "acme")

    profile = client.get(f"{API_V1_PREFIX}/companies/{acme['id']}", headers=_AUTH)
    jobs = client.get(f"{API_V1_PREFIX}/companies/{acme['id']}/jobs", headers=_AUTH)

    assert profile.status_code == 200
    assert profile.json()["name"] == "Acme Corp"
    assert jobs.status_code == 200
    body = jobs.json()
    assert body["company_name"] == "Acme Corp"
    assert body["total"] == 3
    # Real posting links only; the unrelated company's posting is excluded.
    assert {job["url"] for job in body["jobs"]} == {
        "https://jobs.example/1",
        "https://jobs.example/2",
        "https://jobs.example/3",
    }


def test_unknown_or_malformed_company_id_is_not_found() -> None:
    client = _make(FakeJobSearch(RESULTS))

    for company_id in ("co_bm90LWEtY29tcGFueQ", "not-an-id", "co_%%%"):
        response = client.get(f"{API_V1_PREFIX}/companies/{company_id}", headers=_AUTH)

        assert response.status_code == 404


def test_provider_failure_is_a_bad_gateway_not_empty_data() -> None:
    client = _make(FakeJobSearch(fail=True))

    response = client.post(
        f"{API_V1_PREFIX}/companies/search", json={"query": "acme"}, headers=_AUTH
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "company_search_error"


def test_repeated_searches_are_cached_to_protect_the_job_api_quota() -> None:
    provider = FakeJobSearch(RESULTS)
    client = _make(provider)

    _search(client, "acme")
    _search(client, "acme")

    assert provider.queries == ["acme"]
