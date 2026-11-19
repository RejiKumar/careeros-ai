"""Market Pulse API tests with a fake market-data provider."""

from __future__ import annotations

from app.core.config import Settings
from app.integrations.market_data.provider import (
    CompanyCount,
    MarketDataProvider,
    MarketDataUnavailableError,
    SkillCount,
    get_market_data_provider,
)
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients

_AUTH = {"Authorization": "Bearer good-token"}


class FakeMarketData(MarketDataProvider):
    def __init__(self, *, fail: bool = False) -> None:
        self._fail = fail
        self.locations: list[str | None] = []

    def skill_counts(self, skills: list[str], location: str | None) -> list[SkillCount]:
        if self._fail:
            raise MarketDataUnavailableError("down")
        self.locations.append(location)
        table = {
            "Python": SkillCount("Python", 200),
            "React": SkillCount("React", 100),
            "Java": SkillCount("Java", 90),
            "AWS": SkillCount("AWS", 0),
        }
        return [table[s] for s in skills if s in table]

    def top_companies(self, role: str, location: str | None, limit: int) -> list[CompanyCount]:
        if self._fail:
            raise MarketDataUnavailableError("down")
        return [CompanyCount("Acme", 42), CompanyCount("Beta", 17)]


def _make(provider: FakeMarketData) -> TestClient:
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: FakeClients()
    app.dependency_overrides[get_market_data_provider] = lambda: provider
    return TestClient(app)


def test_market_pulse_reports_real_counts_ranked_by_demand() -> None:
    provider = FakeMarketData()
    client = _make(provider)

    response = client.get(f"{API_V1_PREFIX}/market-pulse?location=Bangalore", headers=_AUTH)

    assert response.status_code == 200
    demands = response.json()["skill_demands"]
    assert [d["skill"] for d in demands] == ["Python", "React", "Java", "AWS"]
    assert [d["job_count"] for d in demands] == [200, 100, 90, 0]
    assert demands[0]["demand_score"] == 100.0
    assert demands[1]["demand_score"] == 50.0
    assert {d["period"] for d in demands} == {"30d"}
    assert provider.locations == ["Bangalore"]


def test_market_pulse_does_not_report_unsupportable_growth_or_salary() -> None:
    client = _make(FakeMarketData())

    body = client.get(f"{API_V1_PREFIX}/market-pulse", headers=_AUTH).json()

    assert {d["change_percent"] for d in body["skill_demands"]} == {None}
    assert body["salary_ranges"] == []


def test_top_companies_come_from_the_provider() -> None:
    client = _make(FakeMarketData())

    body = client.get(f"{API_V1_PREFIX}/market-pulse", headers=_AUTH).json()

    assert [(c["name"], c["job_count"]) for c in body["top_companies"]] == [
        ("Acme", 42),
        ("Beta", 17),
    ]


def test_skill_trends_recommend_the_most_demanded_skills_without_invented_trends() -> None:
    client = _make(FakeMarketData())

    body = client.get(f"{API_V1_PREFIX}/market-pulse/trends", headers=_AUTH).json()

    assert body["trends"] == []
    assert body["recommended_skills"] == ["Python", "React", "Java"]


def test_unavailable_market_data_is_an_error_not_sample_data() -> None:
    client = _make(FakeMarketData(fail=True))

    for path in ("/market-pulse", "/market-pulse/trends"):
        response = client.get(f"{API_V1_PREFIX}{path}", headers=_AUTH)

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "market_data_unavailable"


def test_market_pulse_requires_authentication() -> None:
    client = _make(FakeMarketData())

    assert client.get(f"{API_V1_PREFIX}/market-pulse").status_code == 401
