"""Resume rewrite suggestion API tests using in-memory fakes."""

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


def _import(client: TestClient) -> str:
    response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    )
    assert response.status_code == 201
    return response.json()["resume"]["id"]


def _generate(client: TestClient, resume_id: str) -> httpx.Response:
    return client.post(f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites", headers=_AUTH)


def test_generate_rewrites_succeeds() -> None:
    client, clients = _make(FakeProvider())
    imported = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    ).json()
    resume_id = imported["resume"]["id"]
    version_id = imported["version"]["id"]

    response = _generate(client, resume_id)

    assert response.status_code == 201
    body = response.json()
    assert body["resume_id"] == resume_id
    assert body["status"] == "pending"
    assert body["suggestions"][0]["id"] == "rw-1"
    assert body["suggestions"][0]["section"] == "summary"
    assert body["suggestions"][0]["rewritten"].startswith("Mathematician and author")
    assert body["model_version"] == "gemini-3.6-flash"

    rows = clients.service_client.table("rewrite_suggestions").rows
    assert len(rows) == 1
    assert rows[0]["status"] == "pending"
    assert rows[0]["resume_version_id"] == version_id


def test_generate_requires_authentication() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(f"{API_V1_PREFIX}/resumes/unknown/rewrites")

    assert response.status_code == 401


def test_generate_other_resume_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = _generate(client, "unknown-id")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_generate_provider_failure_returns_502() -> None:
    provider = FakeProvider()
    client, clients = _make(provider)
    resume_id = _import(client)
    provider._error = ProviderError("down")  # type: ignore[attr-defined]

    response = _generate(client, resume_id)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"
    assert clients.service_client.table("rewrite_suggestions").rows == []


def test_accept_creates_snapshot_version() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]

    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}/accept",
        json={"accepted_data": {"contact": {"full_name": "Ada Lovelace"}, "summary": "Improved."}},
        headers=_AUTH,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["resume_id"] == resume_id
    assert body["version"] == 2
    assert body["status"] == "accepted"

    versions = clients.service_client.table("resume_versions").rows
    assert len(versions) == 2
    assert versions[1]["version"] == 2
    assert versions[1]["source"] == "ai_suggestion"
    assert versions[1]["structured_data"]["summary"] == "Improved."

    resumes = clients.service_client.table("resumes").rows
    assert resumes[0]["current_version_id"] == versions[1]["id"]

    batches = clients.service_client.table("rewrite_suggestions").rows
    assert batches[0]["status"] == "accepted"
    assert batches[0]["accepted_version_id"] == versions[1]["id"]


def test_accept_unknown_batch_is_not_found() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)

    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/unknown/accept",
        json={"accepted_data": {"contact": {"full_name": "Ada"}}},
        headers=_AUTH,
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_accept_twice_is_conflict() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]
    accept = {
        "accepted_data": {"contact": {"full_name": "Ada Lovelace"}, "summary": "Improved."}
    }
    assert client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}/accept",
        json=accept,
        headers=_AUTH,
    ).status_code == 201

    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}/accept",
        json=accept,
        headers=_AUTH,
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "rewrite_already_accepted"


def test_list_batches_for_resume() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    _generate(client, resume_id)

    response = client.get(f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites", headers=_AUTH)

    assert response.status_code == 200
    batches = response.json()
    assert len(batches) == 1
    assert batches[0]["status"] == "pending"
    assert batches[0]["suggestions"][0]["section"] == "summary"


def test_list_batches_other_resume_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(f"{API_V1_PREFIX}/resumes/unknown/rewrites", headers=_AUTH)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_single_batch_returns_batch() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]

    response = client.get(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}", headers=_AUTH
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == batch_id
    assert body["resume_version_id"] is not None
    assert body["source_version_number"] == 1


def test_get_single_batch_unknown_is_not_found() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)

    response = client.get(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/unknown", headers=_AUTH
    )

    assert response.status_code == 404


def test_get_single_batch_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]

    other_client, _ = _make(FakeProvider())
    response = other_client.get(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}",
        headers={"Authorization": "Bearer bad-token"},
    )

    assert response.status_code == 401


def test_accept_stale_version_is_conflict() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]

    # Simulate the resume being edited (new version created) after batch generation
    new_version = clients.service_client.table("resume_versions").insert(
        {
            "resume_id": resume_id,
            "user_id": "u-1",
            "version": 2,
            "source": "edit",
            "structured_data": {"contact": {"full_name": "Ada"}},
            "source_request_id": None,
        }
    ).execute().data[0]
    clients.service_client.table("resumes").rows[0]["current_version_id"] = new_version["id"]

    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}/accept",
        json={"accepted_data": {"contact": {"full_name": "Ada Lovelace"}, "summary": "Improved."}},
        headers=_AUTH,
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "rewrite_stale_version"


def test_accept_other_user_batch_is_not_found() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]

    other_client, other_clients = _make(FakeProvider())
    other_resume_id = _import(other_client)

    response = other_client.post(
        f"{API_V1_PREFIX}/resumes/{other_resume_id}/rewrites/{batch_id}/accept",
        json={"accepted_data": {"contact": {"full_name": "Ada"}}},
        headers=_AUTH,
    )

    assert response.status_code == 404


def test_accept_partial_suggestions_creates_version() -> None:
    """Accept only some suggestions — server does not validate against batch suggestions."""
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    batch_id = _generate(client, resume_id).json()["id"]

    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites/{batch_id}/accept",
        json={
            "accepted_data": {
                "contact": {"full_name": "Ada Lovelace"},
                "summary": "Partial accept.",
            }
        },
        headers=_AUTH,
    )

    assert response.status_code == 201
    assert response.json()["version"] == 2
    assert response.json()["status"] == "accepted"


def test_batch_response_includes_version_info() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    body = _generate(client, resume_id).json()

    assert "resume_version_id" in body
    assert body["source_version_number"] == 1
