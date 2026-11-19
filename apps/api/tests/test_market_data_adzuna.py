"""Adzuna market-data adapter tests (recorded response shapes, no live calls)."""

from __future__ import annotations

import httpx
import pytest
from app.integrations.market_data import adzuna
from app.integrations.market_data.adzuna import AdzunaMarketData
from app.integrations.market_data.provider import MarketDataUnavailableError

APP_ID = "test-app-id"
APP_KEY = "secret-app-key"


@pytest.fixture(autouse=True)
def _fresh_cache() -> None:
    adzuna.clear_cache()


def _provider(handler) -> tuple[AdzunaMarketData, list[httpx.Request]]:  # type: ignore[no-untyped-def]
    captured: list[httpx.Request] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    return (
        AdzunaMarketData(
            app_id=APP_ID,
            app_key=APP_KEY,
            country="in",
            transport=httpx.MockTransport(_handler),
        ),
        captured,
    )


def test_skill_counts_compare_the_last_30_days_with_the_30_before() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        days = int(request.url.params["max_days_old"])
        # 30 days -> 100 postings, 60 days -> 160 (so 60 posted 30-60 days ago).
        return httpx.Response(200, json={"count": 100 if days == 30 else 160, "results": []})

    provider, captured = _provider(handler)

    [python] = provider.skill_counts(["Python"], "Bangalore")

    assert (python.skill, python.last_30_days, python.previous_30_days) == ("Python", 100, 60)
    assert {r.url.params["where"] for r in captured} == {"Bangalore"}
    assert all(r.url.path.endswith("/in/search/1") for r in captured)


def test_salary_stats_come_from_the_histogram() -> None:
    histogram = {"300000": 10, "600000": 30, "900000": 40, "1200000": 20, "1500000": 0}
    provider, captured = _provider(
        lambda _request: httpx.Response(200, json={"histogram": histogram})
    )

    stats = provider.salary_stats("Software Engineer", None)

    assert stats is not None
    assert stats.min_salary == 300000
    assert stats.median_salary == 900000
    assert stats.max_salary == 1200000
    assert stats.currency == "INR"
    assert stats.sample_size == 100
    assert captured[0].url.path.endswith("/in/histogram")


def test_salary_stats_without_salary_data_is_none() -> None:
    provider, _ = _provider(lambda _request: httpx.Response(200, json={"histogram": {}}))

    assert provider.salary_stats("Astronaut", None) is None


def test_top_companies_come_from_the_leaderboard() -> None:
    board = {
        "leaderboard": [
            {"canonical_name": "Acme", "count": 42, "average_salary": 900000},
            {"canonical_name": "Beta", "count": 17, "average_salary": 800000},
            {"count": 5},
        ]
    }
    provider, _ = _provider(lambda _request: httpx.Response(200, json=board))

    companies = provider.top_companies("software engineer", None, 5)

    assert [(c.name, c.job_count) for c in companies] == [("Acme", 42), ("Beta", 17)]


def test_http_errors_become_unavailable_without_leaking_credentials() -> None:
    provider, _ = _provider(lambda _request: httpx.Response(429, json={"error": "quota"}))

    with pytest.raises(MarketDataUnavailableError) as raised:
        provider.top_companies("software engineer", None, 5)

    assert APP_KEY not in str(raised.value)


def test_unexpected_payloads_become_unavailable() -> None:
    provider, _ = _provider(lambda _request: httpx.Response(200, json={"count": "many"}))

    with pytest.raises(MarketDataUnavailableError):
        provider.skill_counts(["Python"], None)


def test_results_are_cached_so_the_free_quota_is_not_burned() -> None:
    provider, captured = _provider(lambda _request: httpx.Response(200, json={"leaderboard": []}))

    provider.top_companies("software engineer", None, 5)
    provider.top_companies("software engineer", None, 5)

    assert len(captured) == 1
