"""Adzuna market-data adapter tests (recorded response shapes, no live calls)."""

from __future__ import annotations

import logging
from collections.abc import Callable

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


def _provider(
    handler: Callable[[httpx.Request], httpx.Response],
) -> tuple[AdzunaMarketData, list[httpx.Request]]:
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
            sleep=lambda seconds: None,
        ),
        captured,
    )


def test_skill_counts_are_postings_from_the_last_30_days() -> None:
    provider, captured = _provider(lambda _request: httpx.Response(200, json={"count": 1234}))

    [python, react] = provider.skill_counts(["Python", "React"], "Bangalore")

    assert (python.skill, python.last_30_days) == ("Python", 1234)
    assert react.skill == "React"
    assert {r.url.params["max_days_old"] for r in captured} == {"30"}
    assert {r.url.params["where"] for r in captured} == {"Bangalore"}
    assert all(r.url.path.endswith("/in/search/1") for r in captured)


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


def test_a_transient_failure_is_retried_once() -> None:
    responses = iter([httpx.Response(429, json={}), httpx.Response(200, json={"leaderboard": []})])
    provider, captured = _provider(lambda _request: next(responses))

    assert provider.top_companies("software engineer", None, 5) == []
    assert len(captured) == 2


def test_a_persistent_failure_becomes_unavailable_without_leaking_credentials(
    caplog: pytest.LogCaptureFixture,
) -> None:
    provider, _ = _provider(lambda _request: httpx.Response(429, json={"error": "quota"}))

    with caplog.at_level(logging.WARNING), pytest.raises(MarketDataUnavailableError) as raised:
        provider.top_companies("software engineer", None, 5)

    assert APP_KEY not in str(raised.value)
    assert APP_KEY not in caplog.text
    assert "429" in caplog.text


def test_non_transient_errors_are_not_retried() -> None:
    provider, captured = _provider(lambda _request: httpx.Response(401, json={}))

    with pytest.raises(MarketDataUnavailableError):
        provider.top_companies("software engineer", None, 5)

    assert len(captured) == 1


def test_timeouts_become_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    provider, captured = _provider(handler)

    with pytest.raises(MarketDataUnavailableError):
        provider.top_companies("software engineer", None, 5)

    assert len(captured) == 2


def test_unexpected_payloads_become_unavailable() -> None:
    provider, _ = _provider(lambda _request: httpx.Response(200, json={"count": "many"}))

    with pytest.raises(MarketDataUnavailableError):
        provider.skill_counts(["Python"], None)


def test_results_are_cached_so_the_free_quota_is_not_burned() -> None:
    provider, captured = _provider(lambda _request: httpx.Response(200, json={"leaderboard": []}))

    provider.top_companies("software engineer", None, 5)
    provider.top_companies("software engineer", None, 5)

    assert len(captured) == 1
