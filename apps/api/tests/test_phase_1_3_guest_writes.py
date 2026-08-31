"""Phase 1-3 write paths: guests must be provisioned before inserts.

Saved jobs, applications, companies and alert preferences carry a
guest_accounts foreign key; missing rows surface as 23503 violations.
Each write-path service must call ensure_guest_account for guests.
"""

from __future__ import annotations

import uuid
from datetime import date

from app.ai.provider import get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider


def _make() -> tuple[TestClient, FakeClients]:
    clients = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_ai_provider] = lambda: FakeProvider()
    return TestClient(app), clients


def _guest_id() -> str:
    return str(uuid.uuid4())


def _guest_rows(clients: FakeClients) -> list[dict]:
    return clients.service_client._rows["guest_accounts"]


def test_create_application_provisions_guest() -> None:
    client, clients = _make()
    guest_id = _guest_id()

    response = client.post(
        f"{API_V1_PREFIX}/applications",
        headers={"X-Guest-Id": guest_id},
        json={"job_title": "QA Engineer", "company": "Atlassian", "status": "applied"},
    )

    assert response.status_code == 201
    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]
    body = response.json()
    assert body["job_title"] == "QA Engineer"
    assert body["company"] == "Atlassian"
    assert clients.service_client._rows["applications"][0]["guest_id"] == guest_id


def test_create_application_defaults_applied_at_to_today() -> None:
    client, clients = _make()
    guest_id = _guest_id()

    response = client.post(
        f"{API_V1_PREFIX}/applications",
        headers={"X-Guest-Id": guest_id},
        json={"job_title": "QA Engineer", "company": "Atlassian", "status": "applied"},
    )

    assert response.status_code == 201
    assert response.json()["applied_at"] == date.today().isoformat()


def test_create_application_keeps_explicit_applied_at() -> None:
    client, _ = _make()
    guest_id = _guest_id()

    response = client.post(
        f"{API_V1_PREFIX}/applications",
        headers={"X-Guest-Id": guest_id},
        json={
            "job_title": "QA Engineer",
            "company": "Atlassian",
            "status": "applied",
            "applied_at": "2026-08-01",
        },
    )

    assert response.status_code == 201
    assert response.json()["applied_at"] == "2026-08-01"


def test_save_job_provisions_guest() -> None:
    client, clients = _make()
    guest_id = _guest_id()

    response = client.post(
        f"{API_V1_PREFIX}/job-search/saved",
        headers={"X-Guest-Id": guest_id},
        json={
            "job_id": "j-1",
            "job_title": "Frontend Engineer",
            "company": "Acme",
            "source": "linkedin",
            "url": "https://example.com/job",
        },
    )

    assert response.status_code == 201
    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]


def test_save_company_provisions_guest() -> None:
    client, clients = _make()
    guest_id = _guest_id()

    response = client.post(
        f"{API_V1_PREFIX}/companies/saved",
        headers={"X-Guest-Id": guest_id},
        json={"company_name": "Acme Corp"},
    )

    assert response.status_code == 201
    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]


def test_upsert_alert_preference_provisions_guest() -> None:
    client, clients = _make()
    guest_id = _guest_id()

    response = client.put(
        f"{API_V1_PREFIX}/job-search/alerts",
        headers={"X-Guest-Id": guest_id},
        json={"query": "react native", "frequency": "daily", "enabled": True},
    )

    assert response.status_code == 200
    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]


def test_guest_provisioning_is_idempotent_across_writes() -> None:
    client, clients = _make()
    guest_id = _guest_id()

    for _ in range(2):
        response = client.post(
            f"{API_V1_PREFIX}/applications",
            headers={"X-Guest-Id": guest_id},
            json={"job_title": "Backend Engineer", "company": "Spotify", "status": "applied"},
        )
        assert response.status_code == 201

    assert len(_guest_rows(clients)) == 1