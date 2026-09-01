"""Adzuna job search adapter fixture tests.

Uses httpx.MockTransport so no live API call is made; the fixtures pin the
adapter contract: URL shape, query params, result normalisation (including
untrusted/malformed fields) and the error mapping to JobSearchProviderError.
"""

from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest
from app.core.config import Settings
from app.integrations.job_search.adzuna import AdzunaJobSearchProvider
from app.integrations.job_search.mock import MockJobSearchProvider
from app.integrations.job_search.provider import (
    JobSearchProvider,
    JobSearchProviderError,
    build_job_search_provider,
    get_job_search_provider,
)
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients

_AUTH = {"Authorization": "Bearer good-token"}

APP_ID = "test-app-id"
APP_KEY = "test-app-key"


def _provider(
    handler: Callable[[httpx.Request], httpx.Response],
) -> tuple[AdzunaJobSearchProvider, list[httpx.Request]]:
    captured: list[httpx.Request] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    provider = AdzunaJobSearchProvider(
        app_id=APP_ID,
        app_key=APP_KEY,
        country="gb",
        transport=httpx.MockTransport(_handler),
    )
    return provider, captured


def _item(**overrides: object) -> dict:
    base: dict = {
        "id": 12345,
        "title": "Senior Python Engineer",
        "company": {"display_name": "Acme Corp"},
        "location": {"display_name": "London, Greater London"},
        "redirect_url": "https://www.adzuna.co.uk/jobs/land/12345",
        "description": "Build scalable services in Python.",
        "salary_min": 80000,
        "salary_max": 90000,
        "salary_is_predicted": False,
        "created": "2026-08-14T10:00:00Z",
    }
    base.update(overrides)
    return base


def _ok_payload(items: list[dict]) -> dict:
    return {"count": len(items), "results": items}


def test_search_request_contract_is_pinned() -> None:
    provider, captured = _provider(
        lambda request: httpx.Response(200, json=_ok_payload([_item()]))
    )

    provider.search("python", "London", None, page=2, limit=10)

    assert len(captured) == 1
    request = captured[0]
    assert request.method == "GET"
    assert request.url.path == "/v1/api/jobs/gb/search/2"
    params = dict(request.url.params)
    assert params["app_id"] == APP_ID
    assert params["app_key"] == APP_KEY
    assert params["what"] == "python"
    assert params["where"] == "London"
    assert params["results_per_page"] == "10"
    assert params["content-type"] == "application/json"


def test_search_normalises_results() -> None:
    provider, _ = _provider(
        lambda request: httpx.Response(200, json=_ok_payload([_item()]))
    )

    results = provider.search("python", None, None, page=1, limit=5)

    assert len(results) == 1
    result = results[0]
    assert result.id == "12345"
    assert result.title == "Senior Python Engineer"
    assert result.company == "Acme Corp"
    assert result.location == "London, Greater London"
    assert result.source == "adzuna"
    assert result.url == "https://www.adzuna.co.uk/jobs/land/12345"
    assert result.salary_range == "80000-90000 (stated)"
    assert result.posted_date == "2026-08-14"
    assert result.match_score is None


def test_search_default_query_and_limit_capped() -> None:
    provider, captured = _provider(
        lambda request: httpx.Response(200, json=_ok_payload([]))
    )

    provider.search("", None, "adzuna", page=1, limit=500)

    params = dict(captured[0].url.params)
    assert params["what"] == "software"
    assert params["results_per_page"] == "50"


def test_search_tolerates_malformed_items() -> None:
    provider, _ = _provider(
        lambda request: httpx.Response(
            200,
            json=_ok_payload(
                [
                    {"id": None, "company": "not-a-dict", "location": None},
                    {"id": "abc", "title": "Data Analyst", "salary_min": "abc"},
                ]
            ),
        )
    )

    results = provider.search("data", None, None, page=1, limit=5)

    assert len(results) == 2
    assert results[0].title == "Untitled role"
    assert results[0].company == ""
    assert results[0].location == ""
    assert results[0].posted_date is None
    assert results[0].salary_range is None
    assert results[1].company == ""
    assert results[1].salary_range is None


def test_search_estimated_salary_label() -> None:
    provider, _ = _provider(
        lambda request: httpx.Response(
            200,
            json=_ok_payload(
                [_item(salary_min=None, salary_max=95000, salary_is_predicted=True)]
            ),
        )
    )

    results = provider.search("python", None, None, page=1, limit=5)

    assert results[0].salary_range == "95000-95000 (estimated)"


@pytest.mark.parametrize(
    ("status", "payload"),
    [
        (500, {"error": "upstream down"}),
        (429, {"error": "rate limited"}),
    ],
)
def test_search_maps_http_errors_to_provider_error(status: int, payload: dict) -> None:
    provider, _ = _provider(lambda request: httpx.Response(status, json=payload))

    with pytest.raises(JobSearchProviderError):
        provider.search("python", None, None, page=1, limit=5)


def test_search_maps_invalid_json_to_provider_error() -> None:
    provider, _ = _provider(
        lambda request: httpx.Response(200, text="<html>not json</html>")
    )

    with pytest.raises(JobSearchProviderError):
        provider.search("python", None, None, page=1, limit=5)


def test_build_provider_uses_adzuna_when_credentials_set() -> None:
    settings = Settings(
        adzuna_app_id="app-id",
        adzuna_app_key="app-key",
        adzuna_country="ie",
    )

    provider = build_job_search_provider(settings)

    assert isinstance(provider, AdzunaJobSearchProvider)
    assert provider._country == "ie"  # noqa: SLF001


def test_build_provider_falls_back_to_mock_without_credentials() -> None:
    settings = Settings()

    provider = build_job_search_provider(settings)

    assert isinstance(provider, MockJobSearchProvider)


def test_mock_marks_results_as_sample() -> None:
    provider = MockJobSearchProvider()

    results = provider.search("python", None, "adzuna", page=1, limit=3)

    assert len(results) == 3
    assert all(r.source == "adzuna" for r in results)
    assert results[0].company == "Acme Corp"


def _make_api(provider: JobSearchProvider) -> TestClient:
    clients = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_job_search_provider] = lambda: provider
    return TestClient(app)


def test_search_route_returns_results_via_provider() -> None:
    client = _make_api(MockJobSearchProvider())

    response = client.post(
        f"{API_V1_PREFIX}/job-search/search",
        json={"query": "python", "location": "London", "limit": 2},
        headers=_AUTH,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert len(body["results"]) == 2
    assert body["results"][0]["company"] == "Acme Corp"


def test_search_route_requires_auth() -> None:
    client = _make_api(MockJobSearchProvider())

    response = client.post(
        f"{API_V1_PREFIX}/job-search/search",
        json={"query": "python"},
    )

    assert response.status_code == 401


def test_search_route_maps_provider_failure_to_502() -> None:
    class _AlwaysFails(JobSearchProvider):
        def search(
            self,
            query: str,
            location: str | None,
            source: str | None,
            page: int,
            limit: int,
        ) -> list:
            raise JobSearchProviderError

    client = _make_api(_AlwaysFails())

    response = client.post(
        f"{API_V1_PREFIX}/job-search/search",
        json={"query": "python"},
        headers=_AUTH,
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "search_provider_error"