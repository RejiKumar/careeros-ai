"""Notifications API tests using in-memory fakes.

Covers FCM token registration, notification preferences and the removal of the
unauthenticated public send endpoint (server-only operation).
"""

from __future__ import annotations

import uuid

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


def test_send_endpoint_is_not_exposed() -> None:
    """The public, unauthenticated send endpoint must not exist."""
    client, _ = _make()

    response = client.post(
        f"{API_V1_PREFIX}/notifications/send",
        json={"user_id": "u-999", "title": "spam", "body": "spam"},
    )

    assert response.status_code == 404


def test_send_endpoint_requires_auth_if_present() -> None:
    """Even unauthenticated attempts must not succeed; endpoint is gone."""
    client, _ = _make()

    response = client.post(
        f"{API_V1_PREFIX}/notifications/send",
        headers=_AUTH,
        json={"user_id": "u-1", "title": "hi", "body": "hello"},
    )

    assert response.status_code == 404


def test_register_fcm_token_requires_auth() -> None:
    client, _ = _make()

    response = client.post(
        f"{API_V1_PREFIX}/notifications/fcm-token",
        json={"token": "fcm-1", "platform": "android"},
    )

    assert response.status_code == 401


def test_register_fcm_token_for_user() -> None:
    client, clients = _make()

    response = client.post(
        f"{API_V1_PREFIX}/notifications/fcm-token",
        headers=_AUTH,
        json={"token": "fcm-1", "platform": "android"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["token"] == "fcm-1"
    assert data["platform"] == "android"
    assert data["user_id"] == "u-1"

    rows = clients.service_client.table("fcm_tokens").select("*").execute().data
    assert len(rows) == 1
    assert rows[0]["user_id"] == "u-1"


def test_register_fcm_token_for_guest() -> None:
    client, _ = _make()
    guest_id = str(uuid.uuid4())
    headers = {"X-Guest-Id": guest_id}

    response = client.post(
        f"{API_V1_PREFIX}/notifications/fcm-token",
        headers=headers,
        json={"token": "fcm-guest", "platform": "android"},
    )

    assert response.status_code == 201
    assert response.json()["user_id"] == guest_id


def test_invalid_token_is_rejected() -> None:
    client, _ = _make()

    response = client.post(
        f"{API_V1_PREFIX}/notifications/fcm-token",
        headers={"Authorization": "Bearer bad-token"},
        json={"token": "fcm-1", "platform": "android"},
    )

    assert response.status_code == 401


def test_get_preferences_requires_auth() -> None:
    client, _ = _make()

    response = client.get(f"{API_V1_PREFIX}/notifications/preferences")

    assert response.status_code == 401


def test_update_and_get_preferences_for_user() -> None:
    client, clients = _make()

    update = client.put(
        f"{API_V1_PREFIX}/notifications/preferences",
        headers=_AUTH,
        json={"job_alerts": False, "frequency": "weekly"},
    )
    assert update.status_code == 200
    data = update.json()
    assert data["job_alerts"] is False
    assert data["frequency"] == "weekly"
    assert data["mission_reminders"] is True
    assert data["user_id"] == "u-1"

    fetched = client.get(f"{API_V1_PREFIX}/notifications/preferences", headers=_AUTH)
    assert fetched.status_code == 200
    assert fetched.json()["job_alerts"] is False
    assert fetched.json()["frequency"] == "weekly"

    rows = clients.service_client.table("notification_preferences").select("*").execute().data
    assert len(rows) == 1
    assert rows[0]["user_id"] == "u-1"


def test_guest_preferences_are_isolated_from_users() -> None:
    client, _ = _make()
    guest_id = str(uuid.uuid4())
    guest_headers = {"X-Guest-Id": guest_id}

    update = client.put(
        f"{API_V1_PREFIX}/notifications/preferences",
        headers=guest_headers,
        json={"career_tips": True},
    )
    assert update.status_code == 200
    assert update.json()["user_id"] == guest_id
    assert update.json()["career_tips"] is True

    user_fetch = client.get(f"{API_V1_PREFIX}/notifications/preferences", headers=_AUTH)
    assert user_fetch.status_code == 200
    assert user_fetch.json() is None or user_fetch.json()["user_id"] != guest_id
