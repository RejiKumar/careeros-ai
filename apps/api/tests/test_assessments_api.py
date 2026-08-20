"""Resume health assessment API tests using in-memory fakes."""

from __future__ import annotations

import httpx
from app.ai.provider import ProviderError, get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider

_AUTH = {"Authorization": "Bearer good-token"}
_RESUME_BYTES = b"Ada Lovelace\nMathematician\nSkills: Python, SQL\n"


def _make(provider: FakeProvider) -> tuple[TestClient, FakeClients]:
    clients = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_ai_provider] = lambda: provider
    return TestClient(app), clients


def _import(client: TestClient) -> dict:
    response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    )
    assert response.status_code == 201
    return response.json()


def _assess(client: TestClient, resume_id: str) -> httpx.Response:
    return client.post(f"{API_V1_PREFIX}/resumes/{resume_id}/assessments", headers=_AUTH)


def test_create_assessment_succeeds() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)["resume"]["id"]

    response = _assess(client, resume_id)

    assert response.status_code == 201
    body = response.json()
    assert body["resume_id"] == resume_id
    assert body["status"] == "completed"
    assert [s["dimension"] for s in body["scores"]] == ["impact", "clarity"]
    assert body["scores"][0]["score"] == 72
    assert body["strengths"] == ["Clear contact details and summary."]
    assert body["gaps"][0]["description"].startswith("No measurable outcomes")
    assert body["model_version"] == "gemini-3.6-flash"
    assert body["prompt_version"] == "resume-health-v1"

    rows = clients.service_client.table("assessments").rows
    assert len(rows) == 1
    assert rows[0]["resume_version_id"] == body["resume_version_id"]
    assert rows[0]["strengths"] == ["Clear contact details and summary."]


def test_create_assessment_requires_authentication() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(f"{API_V1_PREFIX}/resumes/unknown/assessments")

    assert response.status_code == 401


def test_create_assessment_other_resume_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = _assess(client, "unknown-id")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_create_assessment_without_content_is_rejected() -> None:
    client, clients = _make(FakeProvider())
    row = clients.service_client.table("resumes").insert(
        {"user_id": "u-1", "title": "Empty resume"}
    ).execute().data[0]

    response = _assess(client, row["id"])

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "no_resume_content"


def test_create_assessment_provider_failure_returns_502() -> None:
    provider = FakeProvider()
    client, clients = _make(provider)
    resume_id = _import(client)["resume"]["id"]
    provider._error = ProviderError("down")  # type: ignore[attr-defined]

    response = _assess(client, resume_id)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"
    assert clients.service_client.table("assessments").rows == []


def test_get_assessment_returns_own_assessment() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)["resume"]["id"]
    assessment_id = _assess(client, resume_id).json()["id"]

    response = client.get(f"{API_V1_PREFIX}/assessments/{assessment_id}", headers=_AUTH)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == assessment_id
    assert body["resume_id"] == resume_id


def test_get_assessment_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(f"{API_V1_PREFIX}/assessments/unknown-id", headers=_AUTH)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
