"""Internal reminder trigger tests.

Covers the out-of-band endpoint that replaces the old in-process APScheduler
timer: scheduler-secret authorisation, its absence from the versioned /api/v1
contract, response shape, and observable failure.

The fake client stamps timestamps with a fixed "now" of 2026-08-12. The trigger
endpoint takes no ``today`` parameter, so these tests build inputs whose
outcome does not depend on the current date: an active mission with no
completion and no prior log for today always yields one mission reminder.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from app.core.config import Settings, get_settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients

RUN_DUE = "/internal/notifications/run-due"
SECRET_HEADER = "X-Scheduler-Secret"
_TEST_SECRET = "test-scheduler-secret"


def _make(
    secret: str = _TEST_SECRET, *, raise_server_exceptions: bool = True
) -> tuple[TestClient, FakeClients]:
    settings = Settings(environment="prod", scheduler_secret=secret)
    clients = FakeClients()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    return TestClient(app, raise_server_exceptions=raise_server_exceptions), clients


def _seed_one_due_mission(clients: FakeClients) -> None:
    clients.service_client.table("fcm_tokens").insert(
        {"user_id": "u-1", "token": "tok-1", "platform": "android"}
    ).execute()
    clients.service_client.table("notification_preferences").insert(
        {
            "user_id": "u-1",
            "job_alerts": True,
            "mission_reminders": True,
            "career_tips": True,
            "frequency": "daily",
        }
    ).execute()
    clients.service_client.table("missions").insert(
        {"id": "m-1", "key": "daily_growth", "is_active": True, "xp_reward": 10}
    ).execute()


# --- authorisation -------------------------------------------------------


def test_missing_secret_is_rejected() -> None:
    client, _ = _make()

    response = client.post(RUN_DUE)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_scheduler_secret"


def test_wrong_secret_is_rejected() -> None:
    client, _ = _make()

    response = client.post(RUN_DUE, headers={SECRET_HEADER: "not-the-secret"})

    assert response.status_code == 401


def test_empty_secret_is_rejected() -> None:
    client, _ = _make()

    response = client.post(RUN_DUE, headers={SECRET_HEADER: ""})

    assert response.status_code == 401


def test_secret_of_wrong_length_is_rejected() -> None:
    """Guards the constant-time comparison against length-only matches."""
    client, _ = _make()

    response = client.post(RUN_DUE, headers={SECRET_HEADER: _TEST_SECRET + "x"})

    assert response.status_code == 401


def test_end_user_bearer_token_alone_is_rejected() -> None:
    """An end-user token must not open the trigger, only the scheduler secret."""
    client, _ = _make()

    response = client.post(RUN_DUE, headers={"Authorization": "Bearer good-token"})

    assert response.status_code == 401


def test_expired_user_token_alone_is_rejected() -> None:
    """An expired end-user token must not open the trigger.

    The fake client resolves any token other than ``good-token`` as invalid, which
    covers the expiry case. Either way the trigger ignores end-user credentials
    entirely, so this holds independently of token state.
    """
    client, _ = _make()

    response = client.post(RUN_DUE, headers={"Authorization": "Bearer expired-token"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_scheduler_secret"


def test_guest_identifier_alone_is_rejected() -> None:
    """Spec: a caller presenting only a guest identifier is rejected."""
    client, _ = _make()

    response = client.post(RUN_DUE, headers={"X-Guest-Id": "5d2b0a2e-6f3c-4a1e-9f0b-1c2d3e4f5a6b"})

    assert response.status_code == 401


def test_guest_identifier_does_not_substitute_for_the_secret() -> None:
    client, clients = _make()
    _seed_one_due_mission(clients)

    response = client.post(RUN_DUE, headers={"X-Guest-Id": "5d2b0a2e-6f3c-4a1e-9f0b-1c2d3e4f5a6b"})

    assert response.status_code == 401
    assert clients.service_client.table("notification_logs").select("*").execute().data == []


def test_unconfigured_secret_refuses_and_reports_missing_prerequisite(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Absent secret must fail closed and name the missing configuration."""
    client, _ = _make(secret="")

    with caplog.at_level("ERROR"):
        response = client.post(RUN_DUE, headers={SECRET_HEADER: "anything"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "scheduler_not_configured"
    assert "CAREEROS_SCHEDULER_SECRET" in caplog.text
    assert "prod" in caplog.text


# --- routing contract ----------------------------------------------------


def test_endpoint_is_outside_the_versioned_api_contract() -> None:
    """The trigger must not appear under /api/v1."""
    client, _ = _make()

    response = client.post(
        f"{API_V1_PREFIX}/internal/notifications/run-due",
        headers={SECRET_HEADER: _TEST_SECRET},
    )

    assert response.status_code == 404


def test_health_is_unaffected_by_absent_secret() -> None:
    """Spec: an absent secret must not stop the API serving /health."""
    settings = Settings(environment="prod", scheduler_secret="")
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    client = TestClient(app)

    assert client.get("/health").status_code == 200
    assert client.get(f"{API_V1_PREFIX}/health").status_code == 200


# --- successful invocation -----------------------------------------------


def test_valid_secret_returns_counts(monkeypatch) -> None:
    client, clients = _make()
    _seed_one_due_mission(clients)
    _enable_fcm(monkeypatch)

    response = client.post(RUN_DUE, headers={SECRET_HEADER: _TEST_SECRET})

    assert response.status_code == 200
    assert response.json() == {"followup": 0, "mission": 1}


def test_response_carries_counts_only(monkeypatch) -> None:
    """No recipient, token, email or content may leak into the trigger response."""
    client, clients = _make()
    _seed_one_due_mission(clients)
    _enable_fcm(monkeypatch)

    body = client.post(RUN_DUE, headers={SECRET_HEADER: _TEST_SECRET}).json()

    assert set(body) == {"followup", "mission"}
    serialised = repr(body)
    for leaked in ("u-1", "tok-1", "tok", "streak", "missions"):
        assert leaked not in serialised


def test_repeated_invocation_is_idempotent(monkeypatch) -> None:
    """A repeated trigger on the same day must not double-notify.

    Schedulers retry, so a second trigger reaching the same day must be a
    no-op. The clock is pinned to the fake's fixed "now" so the per-day de-dup
    check lines up with the log timestamps the fake writes.
    """
    client, clients = _make()
    _seed_one_due_mission(clients)
    _enable_fcm(monkeypatch)
    _pin_clock_to_fake_now(monkeypatch)
    headers = {SECRET_HEADER: _TEST_SECRET}

    first = client.post(RUN_DUE, headers=headers).json()
    second = client.post(RUN_DUE, headers=headers).json()

    assert first["mission"] == 1
    assert second["mission"] == 0
    logs = clients.service_client.table("notification_logs").select("*").execute().data
    assert len([log for log in logs if log.get("type") == "mission"]) == 1


# --- observable failure ---------------------------------------------------


def test_failed_evaluation_is_logged_and_reported(
    monkeypatch, caplog: pytest.LogCaptureFixture
) -> None:
    """A broken evaluation must fail visibly rather than silently."""
    from app.modules.notifications import internal_router

    def _boom(clients, settings) -> None:
        raise RuntimeError("supabase unavailable")

    monkeypatch.setattr(internal_router, "build_notification_scheduler", _boom)
    client, _ = _make(raise_server_exceptions=False)

    with caplog.at_level("ERROR"):
        response = client.post(RUN_DUE, headers={SECRET_HEADER: _TEST_SECRET})

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "Due-reminder evaluation failed" in caplog.text
    # The failure body must not disclose the underlying reason.
    assert "supabase unavailable" not in response.text


def test_unauthorised_caller_never_reaches_supabase(monkeypatch) -> None:
    """Authorisation runs first, so a bad secret cannot trigger any data access."""
    from app.modules.notifications import internal_router

    def _boom(clients, settings) -> None:
        raise AssertionError("scheduler must not be built for an unauthorised caller")

    monkeypatch.setattr(internal_router, "build_notification_scheduler", _boom)
    client, _ = _make()

    assert client.post(RUN_DUE, headers={SECRET_HEADER: "wrong"}).status_code == 401


def _enable_fcm(monkeypatch) -> None:
    from app.modules.notifications import scheduler as scheduler_module

    monkeypatch.setattr(scheduler_module.fcm, "is_fcm_available", lambda s: True)
    monkeypatch.setattr(scheduler_module.fcm, "send_message", lambda *a, **k: True)


def _pin_clock_to_fake_now(monkeypatch) -> None:
    """Align the reminder clock with the fake client's fixed 2026-08-12 "now"."""
    from app.modules.notifications import scheduler as scheduler_module

    class _FixedDatetime:
        @staticmethod
        def now(tz=None) -> datetime:  # noqa: ANN001, ARG004 - mirrors datetime.now(tz=UTC)
            return datetime(2026, 8, 12, tzinfo=UTC)

    monkeypatch.setattr(scheduler_module, "datetime", _FixedDatetime)


# --- no in-process timer -------------------------------------------------


def test_scheduler_module_exposes_no_in_process_timer() -> None:
    """The APScheduler entrypoint must be gone; triggers are external now."""
    from app.modules.notifications import scheduler as scheduler_module

    assert not hasattr(scheduler_module, "start_notification_scheduler")


def test_notification_package_does_not_import_apscheduler() -> None:
    """No module may reintroduce an in-process timer behind the API."""
    import app.modules.notifications as notifications_pkg

    offenders = []
    for path in Path(notifications_pkg.__file__).parent.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        if "apscheduler" in source.lower() or "BackgroundScheduler" in source:
            offenders.append(path.name)

    assert offenders == []


def test_app_starts_in_prod_without_a_service_role_key() -> None:
    """Startup must not depend on scheduler prerequisites; only the trigger does."""
    settings = Settings(environment="prod", supabase_service_role_key="")
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200


def test_trigger_requires_a_service_role_client(monkeypatch) -> None:
    """The trigger surfaces the missing prerequisite as a logged failure."""
    from app.modules.notifications import internal_router

    def _no_service_client(clients, settings) -> None:
        raise ValueError("Supabase service-role client is required for the scheduler.")

    monkeypatch.setattr(internal_router, "build_notification_scheduler", _no_service_client)
    client, _ = _make(raise_server_exceptions=False)

    response = client.post(RUN_DUE, headers={SECRET_HEADER: _TEST_SECRET})

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
