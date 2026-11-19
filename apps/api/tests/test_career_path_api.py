"""Career path API tests using in-memory fakes."""

from __future__ import annotations

import json

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


def _import(client: TestClient) -> str:
    response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    )
    assert response.status_code == 201
    return response.json()["resume"]["id"]


def _generate(client: TestClient, resume_id: str, target_role: str | None = None) -> httpx.Response:
    return client.post(
        f"{API_V1_PREFIX}/career-path/generate",
        json={"resume_id": resume_id, "target_role": target_role},
        headers=_AUTH,
    )


def test_generate_builds_the_path_from_the_resume_content() -> None:
    provider = FakeProvider()
    client, clients = _make(provider)
    resume_id = _import(client)

    response = _generate(client, resume_id, "Research Lead")

    assert response.status_code == 200
    body = response.json()
    assert body["current_stage"] == "Mathematician"
    assert [stage["title"] for stage in body["stages"]] == ["Mathematician", "Research Lead"]
    assert body["gap_analysis"] == ["No people-management evidence on the resume."]
    assert body["timeline_estimate"] == "4-6 years"
    content, target_role = provider.career_path_calls[0]
    assert content.contact.full_name == "Ada Lovelace"
    assert target_role == "Research Lead"
    rows = clients.service_client.table("career_paths").rows
    assert len(rows) == 1
    assert rows[0]["target_role"] == "Research Lead"
    assert json.loads(rows[0]["path_data"])["current_stage"] == "Mathematician"


def test_saved_paths_can_be_listed_fetched_and_deleted() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    _generate(client, resume_id, "Research Lead")

    listed = client.get(f"{API_V1_PREFIX}/career-path", headers=_AUTH)
    assert listed.status_code == 200
    saved = listed.json()[0]
    assert saved["target_role"] == "Research Lead"

    fetched = client.get(f"{API_V1_PREFIX}/career-path/{saved['id']}", headers=_AUTH)
    assert fetched.status_code == 200
    assert fetched.json()["current_stage"] == "Mathematician"

    deleted = client.delete(f"{API_V1_PREFIX}/career-path/{saved['id']}", headers=_AUTH)
    assert deleted.status_code == 204
    assert client.get(f"{API_V1_PREFIX}/career-path", headers=_AUTH).json() == []


def test_generate_unknown_resume_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = _generate(client, "missing-resume")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_generate_maps_provider_failure_to_bad_gateway() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)
    failing, _ = _make(FakeProvider(error=ProviderError("boom")))
    failing.app.dependency_overrides[get_supabase_clients] = lambda: clients
    failing_resume = failing.post(
        f"{API_V1_PREFIX}/career-path/generate",
        json={"resume_id": resume_id},
        headers=_AUTH,
    )

    assert failing_resume.status_code == 502
    assert failing_resume.json()["error"]["code"] == "ai_provider_error"


def test_generate_requires_authentication() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(f"{API_V1_PREFIX}/career-path/generate", json={"resume_id": "x"})

    assert response.status_code == 401
