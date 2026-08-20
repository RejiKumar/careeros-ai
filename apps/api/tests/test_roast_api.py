"""Roast endpoint tests: success per mode, ownership, provider failures."""

from __future__ import annotations

import uuid

from app.ai.provider import ProviderError, get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.auth import ERROR_CODE_INVALID, AuthVerificationError
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider, sample_resume_content


class TwoUserClients(FakeClients):
    def verify_jwt(self, access_token: str) -> dict:
        if access_token == "good-token":
            return {"sub": "u-1", "email": "user@example.com", "role": "authenticated"}
        if access_token == "other-token":
            return {"sub": "u-2", "email": "other@example.com", "role": "authenticated"}
        raise AuthVerificationError(ERROR_CODE_INVALID, "Access token is invalid.")


def _make_client(
    provider: FakeProvider, fake: FakeClients | None = None
) -> tuple[TestClient, FakeClients]:
    fake = fake or FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: fake
    app.dependency_overrides[get_ai_provider] = lambda: provider
    return TestClient(app), fake


def _seed_resume(
    fake: FakeClients,
    *,
    guest: bool = False,
    with_content: bool = True,
    guest_id: str | None = None,
) -> str:
    resume = fake.service_client.table("resumes").insert(
        {
            "user_id": None if guest else "u-1",
            "guest_id": guest_id if guest else None,
            "title": "Ada Resume",
        }
    ).execute().data[0]
    version = fake.service_client.table("resume_versions").insert(
        {
            "resume_id": resume["id"],
            "user_id": None if guest else "u-1",
            "version": 1,
            "source": "import",
            "structured_data": sample_resume_content().model_dump(mode="json")
            if with_content
            else None,
        }
    ).execute().data[0]
    fake.service_client.table("resumes").update(
        {"current_version_id": version["id"]}
    ).eq("id", resume["id"]).execute()
    return resume["id"]


def test_roast_success_as_user() -> None:
    client, fake = _make_client(FakeProvider())
    resume_id = _seed_resume(fake)

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        headers={"Authorization": "Bearer good-token"},
        json={"resume_id": resume_id, "mode": "funny_roast"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["mode"] == "funny_roast"
    assert len(body["improvements"]) >= 2
    assert body["id"]
    rows = fake.service_client._rows["roasts"]
    assert rows[0]["user_id"] == "u-1"


def test_roast_success_as_guest() -> None:
    client, fake = _make_client(FakeProvider())
    guest_id = str(uuid.uuid4())
    resume_id = _seed_resume(fake, guest=True, guest_id=guest_id)

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        headers={"X-Guest-Id": guest_id},
        json={"resume_id": resume_id, "mode": "professional_hr"},
    )

    assert response.status_code == 201
    rows = fake.service_client._rows["roasts"]
    assert rows[0]["guest_id"] == guest_id
    assert fake.service_client._rows["guest_accounts"][0]["id"] == guest_id


def test_roast_rejects_other_users_resume() -> None:
    client, fake = _make_client(FakeProvider(), fake=TwoUserClients())
    resume_id = _seed_resume(fake)

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        headers={"Authorization": "Bearer other-token"},
        json={"resume_id": resume_id, "mode": "brutal_hr"},
    )

    assert response.status_code == 404


def test_roast_missing_resume_returns_404() -> None:
    client, _ = _make_client(FakeProvider())

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        headers={"Authorization": "Bearer good-token"},
        json={"resume_id": str(uuid.uuid4()), "mode": "friendly_mentor"},
    )

    assert response.status_code == 404


def test_roast_without_parsed_content_returns_422() -> None:
    client, fake = _make_client(FakeProvider())
    resume_id = _seed_resume(fake, with_content=False)

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        headers={"Authorization": "Bearer good-token"},
        json={"resume_id": resume_id, "mode": "robot_recruiter"},
    )

    assert response.status_code == 422


def test_roast_provider_failure_returns_502() -> None:
    client, fake = _make_client(FakeProvider(error=ProviderError("down")))
    resume_id = _seed_resume(fake)

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        headers={"Authorization": "Bearer good-token"},
        json={"resume_id": resume_id, "mode": "funny_roast"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"


def test_roast_requires_identity() -> None:
    client, fake = _make_client(FakeProvider())
    resume_id = _seed_resume(fake)

    response = client.post(
        f"{API_V1_PREFIX}/roasts",
        json={"resume_id": resume_id, "mode": "funny_roast"},
    )

    assert response.status_code == 401
