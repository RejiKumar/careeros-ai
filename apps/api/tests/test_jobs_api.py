"""Jobs API tests: externally triggered reminder runs guarded by a shared secret."""

from __future__ import annotations

from app.core.config import Settings, get_settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from app.modules.notifications.scheduler import start_notification_scheduler
from fastapi.testclient import TestClient

from .fakes import FakeClients

_PATH = f"{API_V1_PREFIX}/jobs/notification-reminders"
_TEST_SECRET = "s3cret"  # noqa: S105 - test fixture value, not a credential


def _make(cron_secret: str = _TEST_SECRET) -> tuple[TestClient, FakeClients]:
    clients = FakeClients()
    settings = Settings(environment="dev", cron_secret=cron_secret)
    app = create_app(settings)
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app), clients


def test_endpoint_hidden_when_no_secret_configured() -> None:
    client, _ = _make(cron_secret="")
    response = client.post(_PATH, headers={"X-Cron-Secret": ""})
    assert response.status_code == 404


def test_missing_secret_is_forbidden() -> None:
    client, _ = _make()
    response = client.post(_PATH)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_wrong_secret_is_forbidden() -> None:
    client, _ = _make()
    response = client.post(_PATH, headers={"X-Cron-Secret": "nope"})
    assert response.status_code == 403


def test_user_bearer_token_does_not_grant_access() -> None:
    client, _ = _make()
    response = client.post(_PATH, headers={"Authorization": "Bearer good-token"})
    assert response.status_code == 403


def test_valid_secret_runs_reminders() -> None:
    client, _ = _make()
    response = client.post(_PATH, headers={"X-Cron-Secret": "s3cret"})
    assert response.status_code == 200
    assert response.json() == {"followup": 0, "mission": 0}


def test_in_process_scheduler_can_be_disabled() -> None:
    settings = Settings(
        environment="prod",
        in_process_scheduler=False,
        supabase_service_role_key="present",
    )
    assert start_notification_scheduler(settings) is None
