"""Missions and dashboard API tests using in-memory fakes."""
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


def _seed_missions(clients: FakeClients) -> None:
    clients.service_client.table("missions").insert(
        {
            "key": "import_resume", "title": "Import a resume",
            "xp_reward": 50, "cadence": "once", "is_active": True,
        }
    )
    clients.service_client.table("missions").insert(
        {
            "key": "run_assessment", "title": "Run a health assessment",
            "xp_reward": 30, "cadence": "daily", "is_active": True,
        }
    )
    clients.service_client.table("missions").insert(
        {
            "key": "run_match", "title": "Match a job description",
            "xp_reward": 30, "cadence": "daily", "is_active": True,
        }
    )


def test_list_missions() -> None:
    client, clients = _make()
    _seed_missions(clients)

    response = client.get(f"{API_V1_PREFIX}/missions", headers=_AUTH)

    assert response.status_code == 200
    missions = response.json()
    assert len(missions) == 3
    assert missions[0]["key"] == "import_resume"


def test_get_progress_zero() -> None:
    client, clients = _make()
    _seed_missions(clients)

    response = client.get(f"{API_V1_PREFIX}/missions/progress", headers=_AUTH)

    assert response.status_code == 200
    data = response.json()
    assert data["total_xp"] == 0
    assert data["level"] == 1
    assert data["current_streak"] == 0


def test_complete_mission_awards_xp() -> None:
    client, clients = _make()
    _seed_missions(clients)

    response = client.post(
        f"{API_V1_PREFIX}/missions/import_resume/complete",
        headers=_AUTH,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["xp_awarded"] == 50
    assert data["new_total_xp"] == 50
    assert data["already_completed"] is False


def test_complete_mission_twice_is_idempotent() -> None:
    client, clients = _make()
    _seed_missions(clients)

    client.post(f"{API_V1_PREFIX}/missions/import_resume/complete", headers=_AUTH)
    response = client.post(
        f"{API_V1_PREFIX}/missions/import_resume/complete",
        headers=_AUTH,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["xp_awarded"] == 0
    assert data["already_completed"] is True


def test_complete_unknown_mission_is_not_found() -> None:
    client, clients = _make()
    _seed_missions(clients)

    response = client.post(
        f"{API_V1_PREFIX}/missions/unknown/complete",
        headers=_AUTH,
    )

    assert response.status_code == 404


def test_complete_mission_requires_auth() -> None:
    client, clients = _make()
    _seed_missions(clients)

    response = client.post(f"{API_V1_PREFIX}/missions/import_resume/complete")

    assert response.status_code == 401


def test_dashboard_returns_defaults_when_no_data() -> None:
    client, clients = _make()
    _seed_missions(clients)

    response = client.get(f"{API_V1_PREFIX}/dashboard", headers=_AUTH)

    assert response.status_code == 200
    data = response.json()
    assert data["health_score"] is None
    assert data["latest_match_score"] is None
    assert data["total_xp"] == 0
    assert data["active_missions"] is not None
