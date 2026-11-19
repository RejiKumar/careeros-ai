"""Company deep dive API tests using in-memory fakes."""

from __future__ import annotations

from app.ai.provider import get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider

_AUTH = {"Authorization": "Bearer good-token"}


def _make() -> tuple[TestClient, FakeClients]:
    clients = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_ai_provider] = lambda: FakeProvider()
    return TestClient(app), clients


def test_company_jobs_are_never_fabricated() -> None:
    client, clients = _make()
    clients.service_client.table("companies").rows.append(
        {"id": "c-1", "name": "Acme", "location": "Bengaluru", "tech_stack": ["Python"]}
    )

    response = client.get(f"{API_V1_PREFIX}/companies/c-1/jobs", headers=_AUTH)

    assert response.status_code == 200
    assert response.json() == {"company_name": "Acme", "jobs": [], "total": 0}


def test_search_takes_a_json_body() -> None:
    client, _ = _make()

    response = client.post(
        f"{API_V1_PREFIX}/companies/search",
        json={"query": "acme", "location": None},
        headers=_AUTH,
    )

    assert response.status_code == 200
    assert response.json() == []
