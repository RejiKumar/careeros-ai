"""Notification scheduler tests using in-memory fakes.

The fake client stamps timestamps with a fixed "now" of 2026-08-12, so tests
drive the scheduler with today=date(2026, 8, 12) for deterministic dedup.
"""

from __future__ import annotations

from datetime import date

import pytest
from app.core.config import Settings
from app.modules.notifications import scheduler as scheduler_module
from app.modules.notifications.scheduler import (
    NotificationScheduler,
)

from .fakes import FakeClients


@pytest.fixture
def clients_() -> FakeClients:
    return FakeClients()


def _settings(fcm_available: bool = True) -> Settings:
    return Settings(
        environment="prod",
        firebase_credentials_json='{"project_id": "test"}' if fcm_available else "",
    )


def _scheduler(clients: FakeClients, fcm_available: bool = True) -> NotificationScheduler:
    return NotificationScheduler(clients, _settings(fcm_available))


def _with_fcm_available(monkeypatch) -> None:
    monkeypatch.setattr(scheduler_module.fcm, "is_fcm_available", lambda s: True)
    monkeypatch.setattr(scheduler_module.fcm, "send_message", lambda *a, **k: True)


def _add_user_and_token(clients: FakeClients, *, user_id: str, token: str) -> None:
    clients.service_client.table("fcm_tokens").insert(
        {"user_id": user_id, "token": token, "platform": "android"}
    ).execute()


def _add_pref(clients: FakeClients, *, user_id: str, **overrides: bool) -> None:
    row = {
        "user_id": user_id,
        "job_alerts": True,
        "mission_reminders": True,
        "career_tips": True,
        "frequency": "daily",
    }
    row.update(overrides)
    clients.service_client.table("notification_preferences").insert(row).execute()


def _add_active_mission(clients: FakeClients) -> None:
    clients.service_client.table("missions").insert(
        {"id": "m-1", "key": "daily_growth", "is_active": True, "xp_reward": 10}
    ).execute()


def test_no_preferences_returns_zero_counts(clients_: FakeClients) -> None:
    sch = _scheduler(clients_)
    summary = sch.run_due(today=date(2026, 8, 12))
    assert summary == {"followup": 0, "mission": 0}


def test_mission_reminder_sent_and_logged(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1", mission_reminders=True)
    _add_active_mission(clients_)

    sch = _scheduler(clients_)
    summary = sch.run_due(today=date(2026, 8, 12))

    assert summary["mission"] == 1
    logs = clients_.service_client.table("notification_logs").select("*").execute().data
    mission_logs = [log for log in logs if log.get("type") == "mission"]
    assert len(mission_logs) == 1
    assert mission_logs[0]["user_id"] == "u-1"


def test_mission_reminder_skipped_when_completed_today(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1")
    _add_active_mission(clients_)
    clients_.service_client.table("mission_completions").insert(
        {"user_id": "u-1", "mission_id": "m-1", "completed_on": "2026-08-12", "xp_awarded": 10}
    ).execute()

    summary = _scheduler(clients_).run_due(today=date(2026, 8, 12))
    assert summary["mission"] == 0


def test_mission_reminder_deduped_per_day(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1")
    _add_active_mission(clients_)

    sch = _scheduler(clients_)
    first = sch.run_due(today=date(2026, 8, 12))
    second = sch.run_due(today=date(2026, 8, 12))
    assert first["mission"] == 1
    assert second["mission"] == 0


def test_followup_reminder_for_due_interview(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1", job_alerts=True)
    clients_.service_client.table("applications").insert(
        {
            "user_id": "u-1",
            "job_title": "Backend Engineer",
            "company": "Acme",
            "status": "applied",
            "interview_date": "2026-08-12",
        }
    ).execute()

    summary = _scheduler(clients_).run_due(today=date(2026, 8, 12))
    assert summary["followup"] == 1


def test_followup_skipped_when_not_due_today(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1", job_alerts=True)
    clients_.service_client.table("applications").insert(
        {
            "user_id": "u-1",
            "job_title": "Backend Engineer",
            "company": "Acme",
            "status": "applied",
            "interview_date": "2026-08-20",
        }
    ).execute()

    summary = _scheduler(clients_).run_due(today=date(2026, 8, 12))
    assert summary["followup"] == 0


def test_requires_fcm_token(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_pref(clients_, user_id="u-1")
    _add_active_mission(clients_)

    summary = _scheduler(clients_).run_due(today=date(2026, 8, 12))
    assert summary == {"followup": 0, "mission": 0}


def test_respects_disabled_mission_reminders(clients_: FakeClients, monkeypatch) -> None:
    _with_fcm_available(monkeypatch)
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1", mission_reminders=False)
    _add_active_mission(clients_)

    summary = _scheduler(clients_).run_due(today=date(2026, 8, 12))
    assert summary["mission"] == 0


def test_fcm_unavailable_counts_but_does_not_log(clients_: FakeClients) -> None:
    _add_user_and_token(clients_, user_id="u-1", token="tok-1")
    _add_pref(clients_, user_id="u-1")
    _add_active_mission(clients_)

    sch = _scheduler(clients_, fcm_available=False)
    summary = sch.run_due(today=date(2026, 8, 12))

    assert summary["mission"] == 1
    logs = clients_.service_client.table("notification_logs").select("*").execute().data
    assert logs == []
