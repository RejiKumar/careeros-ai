"""Daily AI usage limits for guests and signed-in users."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from app.ai.provider import ProviderError, get_ai_provider
from app.core import ai_quota as ai_quota_module
from app.core.config import Settings, get_settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider

_USER = {"Authorization": "Bearer good-token"}  # the fake auth maps this to user "u-1"
_SALARY = {"role": "Python Developer", "location": "Bengaluru"}


def _make(
    *,
    guest_limit: int = 3,
    user_limit: int = 2,
    provider: FakeProvider | None = None,
) -> tuple[TestClient, FakeClients]:
    clients = FakeClients()
    settings = Settings(
        environment="dev", ai_daily_limit_guest=guest_limit, ai_daily_limit_user=user_limit
    )
    app = create_app(settings)
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_ai_provider] = lambda: provider or FakeProvider()
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app), clients


def _guest() -> dict[str, str]:
    return {"X-Guest-Id": str(uuid.uuid4())}


def _ai_call(client: TestClient, headers: dict[str, str]) -> httpx.Response:
    return client.post(f"{API_V1_PREFIX}/salary-negotiator/range", json=_SALARY, headers=headers)


def _events(clients: FakeClients) -> list[dict]:
    return clients.service_client._rows.get("ai_usage_events", [])


def _seed_event(clients: FakeClients, owner: dict[str, str], age: timedelta) -> None:
    clients.service_client.table("ai_usage_events").insert(
        {**owner, "feature": "seed", "created_at": (datetime.now(UTC) - age).isoformat()}
    ).execute()


def test_guest_gets_three_actions_then_a_clear_limit_message() -> None:
    client, clients = _make()
    headers = _guest()

    for _ in range(3):
        assert _ai_call(client, headers).status_code == 200
    blocked = _ai_call(client, headers)

    assert blocked.status_code == 429
    error = blocked.json()["error"]
    assert error["code"] == "daily_ai_limit_reached"
    assert "3 free AI actions" in error["message"]
    assert "Create a free account to get 2 a day" in error["message"]
    assert len(_events(clients)) == 3


def test_signed_in_user_has_the_user_limit_and_no_signup_nudge() -> None:
    client, _ = _make(user_limit=2)

    assert _ai_call(client, _USER).status_code == 200
    assert _ai_call(client, _USER).status_code == 200
    blocked = _ai_call(client, _USER)

    assert blocked.status_code == 429
    message = blocked.json()["error"]["message"]
    assert "2 AI actions" in message
    assert "account" not in message


def test_each_guest_and_each_user_is_counted_separately() -> None:
    client, _ = _make(guest_limit=1)
    first, second = _guest(), _guest()

    assert _ai_call(client, first).status_code == 200
    assert _ai_call(client, first).status_code == 429
    assert _ai_call(client, second).status_code == 200
    assert _ai_call(client, _USER).status_code == 200


def test_a_failed_ai_call_does_not_use_up_the_allowance() -> None:
    client, clients = _make(guest_limit=1, provider=FakeProvider(error=ProviderError("down")))
    headers = _guest()

    failed = _ai_call(client, headers)

    assert failed.status_code == 502
    assert _events(clients) == []
    assert client.get(f"{API_V1_PREFIX}/billing/ai-usage", headers=headers).json()["used"] == 0


def test_actions_older_than_24_hours_do_not_count() -> None:
    client, clients = _make(guest_limit=1)
    headers = _guest()
    _seed_event(clients, {"guest_id": headers["X-Guest-Id"]}, timedelta(hours=25))

    assert _ai_call(client, headers).status_code == 200


def test_the_message_says_when_the_allowance_renews() -> None:
    client, clients = _make(guest_limit=1)
    headers = _guest()
    _seed_event(clients, {"guest_id": headers["X-Guest-Id"]}, timedelta(hours=22, minutes=30))

    message = _ai_call(client, headers).json()["error"]["message"]

    assert "1 h 30 min" in message or "1 h 29 min" in message


def test_pro_users_are_not_limited() -> None:
    client, clients = _make(user_limit=1)
    clients.service_client.table("entitlements").insert(
        {"user_id": "u-1", "plan": "pro", "status": "active"}
    ).execute()

    for _ in range(3):
        assert _ai_call(client, _USER).status_code == 200


def test_a_limit_of_zero_disables_metering() -> None:
    client, clients = _make(guest_limit=0)
    headers = _guest()

    for _ in range(5):
        assert _ai_call(client, headers).status_code == 200
    assert _events(clients) == []


def test_non_ai_endpoints_are_not_metered() -> None:
    client, clients = _make(guest_limit=1)
    headers = _guest()

    for _ in range(3):
        assert client.get(f"{API_V1_PREFIX}/resumes", headers=headers).status_code == 200

    assert _events(clients) == []


def test_usage_endpoint_reports_used_remaining_and_reset() -> None:
    client, _ = _make(guest_limit=3)
    headers = _guest()
    _ai_call(client, headers)

    usage = client.get(f"{API_V1_PREFIX}/billing/ai-usage", headers=headers).json()

    assert (usage["used"], usage["limit"], usage["remaining"]) == (1, 3, 2)
    assert usage["window_hours"] == 24
    assert datetime.fromisoformat(usage["resets_at"]) > datetime.now(UTC)


def test_usage_endpoint_requires_an_identity() -> None:
    client, _ = _make()

    assert client.get(f"{API_V1_PREFIX}/billing/ai-usage").status_code == 401


def test_an_unavailable_usage_store_does_not_block_the_ai_features(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = _make(guest_limit=1)

    def broken(self: object, actor: object) -> list[datetime]:
        raise RuntimeError("database down")

    monkeypatch.setattr(ai_quota_module.AiQuota, "_window_events", broken)

    assert _ai_call(client, _guest()).status_code == 200


def test_the_usage_migration_is_service_role_only_with_exactly_one_owner() -> None:
    from pathlib import Path

    sql = next(
        Path(__file__)
        .resolve()
        .parents[3]
        .joinpath("supabase", "migrations")
        .glob("*_ai_usage_events.sql")
    ).read_text(encoding="utf8")

    assert "enable row level security" in sql
    assert "create policy" not in sql  # no client access: API service role only
    assert "(user_id is not null) <> (guest_id is not null)" in sql
    assert "on delete cascade" in sql
