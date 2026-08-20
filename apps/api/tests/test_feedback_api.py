"""Feedback endpoint tests: rating upsert, latest-wins, guest and user paths."""

from __future__ import annotations

import uuid

from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients


def _client() -> tuple[TestClient, FakeClients]:
    fake = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: fake
    return TestClient(app), fake


def _guest_headers() -> dict[str, str]:
    return {"X-Guest-Id": str(uuid.uuid4())}


def test_submit_feedback_as_user() -> None:
    client, fake = _client()

    response = client.post(
        f"{API_V1_PREFIX}/feedback",
        headers={"Authorization": "Bearer good-token"},
        json={"output_type": "assessment", "output_id": "a-1", "rating": "helpful"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["rating"] == "helpful"
    rows = fake.service_client._rows["feedback"]
    assert rows[0]["user_id"] == "u-1"
    assert "guest_id" not in rows[0]


def test_submit_feedback_as_guest() -> None:
    client, fake = _client()
    headers = _guest_headers()

    response = client.post(
        f"{API_V1_PREFIX}/feedback",
        headers=headers,
        json={
            "output_type": "coach_message",
            "output_id": "m-1",
            "rating": "not_helpful",
            "reason": "too_generic",
        },
    )

    assert response.status_code == 201
    guest_id = headers["X-Guest-Id"]
    rows = fake.service_client._rows["feedback"]
    assert rows[0]["guest_id"] == guest_id
    assert rows[0]["reason"] == "too_generic"
    assert fake.service_client._rows["guest_accounts"][0]["id"] == guest_id


def test_latest_rating_wins() -> None:
    client, fake = _client()

    first = client.post(
        f"{API_V1_PREFIX}/feedback",
        headers={"Authorization": "Bearer good-token"},
        json={"output_type": "job_match", "output_id": "jd-1", "rating": "helpful"},
    )
    assert first.status_code == 201

    second = client.post(
        f"{API_V1_PREFIX}/feedback",
        headers={"Authorization": "Bearer good-token"},
        json={
            "output_type": "job_match",
            "output_id": "jd-1",
            "rating": "not_helpful",
            "reason": "other",
            "reason_detail": "Too long",
        },
    )
    assert second.status_code == 201

    rows = [r for r in fake.service_client._rows["feedback"] if r["output_id"] == "jd-1"]
    assert len(rows) == 1
    assert rows[0]["rating"] == "not_helpful"


def test_feedback_requires_identity() -> None:
    client, _ = _client()

    response = client.post(
        f"{API_V1_PREFIX}/feedback",
        json={"output_type": "roast", "output_id": "r-1", "rating": "helpful"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "missing_identity"


def test_feedback_invalid_guest_id_rejected() -> None:
    client, _ = _client()

    response = client.post(
        f"{API_V1_PREFIX}/feedback",
        headers={"X-Guest-Id": "not-a-uuid"},
        json={"output_type": "roast", "output_id": "r-1", "rating": "helpful"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_guest_id"


def test_feedback_invalid_output_type_rejected() -> None:
    client, _ = _client()

    response = client.post(
        f"{API_V1_PREFIX}/feedback",
        headers={"Authorization": "Bearer good-token"},
        json={"output_type": "spam", "output_id": "x", "rating": "helpful"},
    )

    assert response.status_code == 422
