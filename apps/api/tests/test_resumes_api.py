"""Resume import/parse API tests using in-memory fakes."""

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


def _import(
    client: TestClient,
    *,
    name: str = "resume.txt",
    content: bytes = _RESUME_BYTES,
    content_type: str = "text/plain",
) -> httpx.Response:
    return client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": (name, content, content_type)},
        headers=_AUTH,
    )


def test_import_success_returns_parsed_resume() -> None:
    client, clients = _make(FakeProvider())

    response = _import(client)

    assert response.status_code == 201
    body = response.json()
    assert body["resume"]["title"] == "resume"
    assert body["resume"]["status"] == "draft"
    assert body["version"]["version"] == 1
    assert body["version"]["source"] == "import"
    assert body["parsed"]["contact"]["full_name"] == "Ada Lovelace"

    resume_id = body["resume"]["id"]
    resumes = clients.service_client.table("resumes").rows
    versions = clients.service_client.table("resume_versions").rows
    assert len(resumes) == 1
    assert len(versions) == 1
    assert resumes[0]["current_version_id"] == versions[0]["id"]
    assert versions[0]["structured_data"]["skills"] == ["Python", "SQL"]
    assert versions[0]["source_request_id"] == "request-1"

    assert clients.service_client.storage.uploads == [
        {
            "bucket": "resumes",
            "path": f"u-1/{resume_id}_imported.txt",
            "content": _RESUME_BYTES,
            "options": {"content-type": "text/plain", "upsert": "false"},
        }
    ]


def test_import_requires_authentication() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
    )

    assert response.status_code == 401


def test_import_without_file_is_rejected() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(f"{API_V1_PREFIX}/resumes/import", headers=_AUTH)

    assert response.status_code == 422


def test_import_unsupported_extension_is_rejected() -> None:
    client, _ = _make(FakeProvider())

    response = _import(client, name="resume.exe", content_type="application/octet-stream")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_upload"


def test_import_mime_mismatch_is_rejected() -> None:
    client, _ = _make(FakeProvider())

    response = _import(client, name="resume.pdf", content_type="text/plain")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_upload"


def test_import_empty_file_is_rejected() -> None:
    client, _ = _make(FakeProvider())

    response = _import(client, content=b"")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_upload"


def test_import_oversized_file_is_rejected() -> None:
    client, _ = _make(FakeProvider())

    response = _import(client, content=b"x" * (10 * 1024 * 1024 + 1))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_upload"


def test_import_provider_failure_rolls_back() -> None:
    client, clients = _make(FakeProvider(error=ProviderError("down")))

    response = _import(client)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"
    assert clients.service_client.table("resumes").rows == []
    assert clients.service_client.table("resume_versions").rows == []
    assert clients.service_client.storage.uploads == []


def test_list_resumes_returns_own_resumes() -> None:
    client, _ = _make(FakeProvider())
    imported = _import(client)
    resume_id = imported.json()["resume"]["id"]

    response = client.get(f"{API_V1_PREFIX}/resumes", headers=_AUTH)

    assert response.status_code == 200
    assert [r["id"] for r in response.json()] == [resume_id]


def test_get_resume_detail_includes_parsed_content() -> None:
    client, _ = _make(FakeProvider())
    imported = _import(client)
    resume_id = imported.json()["resume"]["id"]
    version_id = imported.json()["version"]["id"]

    response = client.get(f"{API_V1_PREFIX}/resumes/{resume_id}", headers=_AUTH)

    assert response.status_code == 200
    body = response.json()
    assert body["resume"]["id"] == resume_id
    assert body["version"]["id"] == version_id
    assert body["parsed"]["contact"]["email"] == "ada@example.com"


def test_get_resume_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(f"{API_V1_PREFIX}/resumes/unknown-id", headers=_AUTH)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def _import_one(client: TestClient) -> dict:
    return _import(client).json()


def _patch(client: TestClient, resume_id: str, payload: dict) -> httpx.Response:
    return client.patch(f"{API_V1_PREFIX}/resumes/{resume_id}", json=payload, headers=_AUTH)


def test_update_saves_new_version_snapshot() -> None:
    client, clients = _make(FakeProvider())
    imported = _import_one(client)
    resume_id = imported["resume"]["id"]
    version_1 = imported["version"]["id"]

    response = _patch(
        client,
        resume_id,
        {
            "structured_data": {
                "contact": {"full_name": "Ada Lovelace"},
                "skills": ["Python", "SQL", "GO"],
            }
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["version"]["version"] == 2
    assert body["version"]["source"] == "edit"
    assert body["version"]["id"] != version_1
    assert body["parsed"]["skills"] == ["Python", "SQL", "GO"]

    versions = clients.service_client.table("resume_versions").rows
    assert len(versions) == 2
    assert versions[0]["version"] == 1
    assert versions[1]["version"] == 2
    assert versions[1]["source"] == "edit"
    assert versions[1]["source_request_id"] is None

    resumes = clients.service_client.table("resumes").rows
    assert resumes[0]["current_version_id"] == versions[1]["id"]


def test_update_renames_resume_without_new_version() -> None:
    client, clients = _make(FakeProvider())
    imported = _import_one(client)
    resume_id = imported["resume"]["id"]

    response = _patch(client, resume_id, {"title": "Senior Resume"})

    assert response.status_code == 200
    assert response.json()["resume"]["title"] == "Senior Resume"
    assert response.json()["version"]["version"] == 1
    assert len(clients.service_client.table("resume_versions").rows) == 1


def test_update_requires_at_least_one_field() -> None:
    client, _ = _make(FakeProvider())
    imported = _import_one(client)

    response = _patch(client, imported["resume"]["id"], {})

    assert response.status_code == 422


def test_update_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = _patch(
        client,
        "unknown-id",
        {"structured_data": {"contact": {"full_name": "Ada Lovelace"}}},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_list_versions_returns_newest_first() -> None:
    client, _ = _make(FakeProvider())
    imported = _import_one(client)
    resume_id = imported["resume"]["id"]
    _patch(
        client,
        resume_id,
        {"structured_data": {"contact": {"full_name": "Ada Lovelace"}}},
    )

    response = client.get(
        f"{API_V1_PREFIX}/resumes/{resume_id}/versions", headers=_AUTH
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["version"] for item in body] == [2, 1]
    assert body[0]["source"] == "edit"
    assert body[1]["source"] == "import"


def test_list_versions_requires_ownership() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(
        f"{API_V1_PREFIX}/resumes/unknown-id/versions", headers=_AUTH
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
