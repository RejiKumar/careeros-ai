"""Guests are registered centrally, before any guest-owned write.

Every guest-owned table has a foreign key to ``guest_accounts``. Resume import
and FCM token registration did not provision the guest themselves, so the first
write from a brand-new guest failed with a 23503 foreign-key violation (HTTP 500)
in production. ``get_current_actor`` now registers the guest for every route.
"""

from __future__ import annotations

import uuid

from app.ai.provider import get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider

_RESUME_BYTES = b"Ada Lovelace\nSkills: Python, SQL\nExperience: Analytical Engine"


def _make() -> tuple[TestClient, FakeClients]:
    clients = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_ai_provider] = lambda: FakeProvider()
    return TestClient(app), clients


def _guest_rows(clients: FakeClients) -> list[dict]:
    return clients.service_client._rows.get("guest_accounts", [])


def test_guest_resume_import_registers_the_guest() -> None:
    client, clients = _make()
    guest_id = str(uuid.uuid4())

    response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers={"X-Guest-Id": guest_id},
    )

    assert response.status_code == 201
    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]
    assert clients.service_client._rows["resumes"][0]["guest_id"] == guest_id


def test_guest_fcm_token_registration_registers_the_guest() -> None:
    client, clients = _make()
    guest_id = str(uuid.uuid4())

    response = client.post(
        f"{API_V1_PREFIX}/notifications/fcm-token",
        json={"token": "fcm-token-1234567890", "platform": "android"},
        headers={"X-Guest-Id": guest_id},
    )

    assert response.status_code < 500
    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]


def test_repeated_guest_requests_register_once() -> None:
    client, clients = _make()
    guest_id = str(uuid.uuid4())
    headers = {"X-Guest-Id": guest_id}

    for _ in range(3):
        assert client.get(f"{API_V1_PREFIX}/resumes", headers=headers).status_code == 200

    assert [row["id"] for row in _guest_rows(clients)] == [guest_id]


def test_signed_in_user_is_not_registered_as_a_guest() -> None:
    client, clients = _make()

    response = client.get(
        f"{API_V1_PREFIX}/resumes", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200
    assert _guest_rows(clients) == []


def test_invalid_guest_id_is_rejected_without_registering() -> None:
    client, clients = _make()

    response = client.get(f"{API_V1_PREFIX}/resumes", headers={"X-Guest-Id": "not-a-uuid"})

    assert response.status_code == 401
    assert _guest_rows(clients) == []
