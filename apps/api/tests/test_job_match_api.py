"""Job description match API tests using in-memory fakes."""

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
_JD_TEXT = "Software Engineer. Required: Python, Go, Kubernetes. Build scalable services."


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


def _create(
    client: TestClient,
    resume_id: str,
    *,
    raw_text: str = _JD_TEXT,
    title: str | None = "Engineer",
    company: str | None = "Acme",
) -> httpx.Response:
    payload: dict = {"raw_text": raw_text, "resume_id": resume_id}
    if title is not None:
        payload["title"] = title
    if company is not None:
        payload["company"] = company
    return client.post(f"{API_V1_PREFIX}/job-descriptions", json=payload, headers=_AUTH)


def test_create_job_description_with_match_succeeds() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)

    response = _create(client, resume_id)

    assert response.status_code == 201
    body = response.json()
    jd = body["job_description"]
    match = body["match"]
    assert jd["title"] == "Engineer"
    assert jd["company"] == "Acme"
    assert jd["raw_text"] == _JD_TEXT
    assert match["score"] == 65
    assert match["matched_skills"] == ["Python"]
    assert match["missing_skills"] == ["Go", "Kubernetes"]
    assert match["model_version"] == "gemini-3.6-flash"

    jd_rows = clients.service_client.table("job_descriptions").rows
    match_rows = clients.service_client.table("job_matches").rows
    assert len(jd_rows) == 1
    assert len(match_rows) == 1
    assert jd_rows[0]["normalized_text"] == (
        "Software Engineer. Required: Python, Go, Kubernetes. Build scalable services."
    )
    assert match_rows[0]["job_description_id"] == jd["id"]
    assert match_rows[0]["resume_version_id"] == body["match"]["resume_version_id"]


def test_create_requires_authentication() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions",
        json={"raw_text": _JD_TEXT, "resume_id": "x"},
    )

    assert response.status_code == 401


def test_create_empty_job_description_is_rejected() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)

    response = _create(client, resume_id, raw_text="   ")

    assert response.status_code == 422


def test_create_with_other_resume_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = _create(client, "unknown-id")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_create_provider_failure_rolls_back_job_description() -> None:
    provider = FakeProvider()
    client, clients = _make(provider)
    resume_id = _import(client)
    provider._error = ProviderError("down")  # type: ignore[attr-defined]

    response = _create(client, resume_id)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"
    assert clients.service_client.table("job_descriptions").rows == []
    assert clients.service_client.table("job_matches").rows == []


def test_get_job_description_returns_own() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.get(f"{API_V1_PREFIX}/job-descriptions/{jd_id}", headers=_AUTH)

    assert response.status_code == 200
    assert response.json()["id"] == jd_id
    assert response.json()["raw_text"] == _JD_TEXT


def test_get_job_description_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(f"{API_V1_PREFIX}/job-descriptions/unknown-id", headers=_AUTH)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_list_matches_for_job_description() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.get(f"{API_V1_PREFIX}/job-descriptions/{jd_id}/matches", headers=_AUTH)

    assert response.status_code == 200
    matches = response.json()
    assert len(matches) == 1
    assert matches[0]["score"] == 65
    assert matches[0]["actions"][0]["title"] == "Add Go projects"


def test_list_matches_for_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(f"{API_V1_PREFIX}/job-descriptions/unknown-id/matches", headers=_AUTH)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_list_job_descriptions_returns_own() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    _create(client, resume_id)
    _create(client, resume_id, raw_text="Another JD", title="Second", company="Beta")

    response = client.get(f"{API_V1_PREFIX}/job-descriptions", headers=_AUTH)

    assert response.status_code == 200
    jds = response.json()
    assert len(jds) == 2
    titles = {jd["title"] for jd in jds}
    assert titles == {"Engineer", "Second"}


def test_list_job_descriptions_requires_auth() -> None:
    client, _ = _make(FakeProvider())

    response = client.get(f"{API_V1_PREFIX}/job-descriptions")

    assert response.status_code == 401


def test_update_job_description_updates_fields() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.patch(
        f"{API_V1_PREFIX}/job-descriptions/{jd_id}",
        json={"title": "Senior Engineer", "company": "BetaCorp"},
        headers=_AUTH,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Senior Engineer"
    assert body["company"] == "BetaCorp"
    assert body["raw_text"] == _JD_TEXT


def test_update_job_description_raw_text_revalidates() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.patch(
        f"{API_V1_PREFIX}/job-descriptions/{jd_id}",
        json={"raw_text": "   "},
        headers=_AUTH,
    )

    assert response.status_code == 422


def test_update_job_description_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.patch(
        f"{API_V1_PREFIX}/job-descriptions/unknown-id",
        json={"title": "x"},
        headers=_AUTH,
    )

    assert response.status_code == 404


def test_delete_job_description_removes_jd_and_cascades_matches() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.delete(f"{API_V1_PREFIX}/job-descriptions/{jd_id}", headers=_AUTH)

    assert response.status_code == 204
    assert clients.service_client.table("job_descriptions").rows == []
    assert clients.service_client.table("job_matches").rows == []


def test_delete_job_description_other_user_is_not_found() -> None:
    client, _ = _make(FakeProvider())

    response = client.delete(f"{API_V1_PREFIX}/job-descriptions/unknown-id", headers=_AUTH)

    assert response.status_code == 404


def test_run_match_against_existing_jd() -> None:
    client, _ = _make(FakeProvider())
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions/{jd_id}/matches",
        json={"resume_id": resume_id},
        headers=_AUTH,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["score"] == 65
    assert body["matched_skills"] == ["Python"]
    assert body["missing_skills"] == ["Go", "Kubernetes"]


def test_run_match_with_specific_resume_version() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)
    # Retrieve the auto-created version id from the fake
    versions = clients.service_client.table("resume_versions").rows
    version_id = versions[0]["id"]
    jd_id = _create(client, resume_id).json()["job_description"]["id"]

    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions/{jd_id}/matches",
        json={"resume_id": resume_id, "resume_version_id": version_id},
        headers=_AUTH,
    )

    assert response.status_code == 201
    assert response.json()["resume_version_id"] == version_id


def test_run_match_requires_existing_jd() -> None:
    client, _ = _make(FakeProvider())

    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions/unknown-id/matches",
        json={"resume_id": "x"},
        headers=_AUTH,
    )

    assert response.status_code == 404


def test_run_match_provider_failure_returns_502() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    resume_id = _import(client)
    jd_id = _create(client, resume_id).json()["job_description"]["id"]
    provider._error = ProviderError("down")  # type: ignore[attr-defined]

    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions/{jd_id}/matches",
        json={"resume_id": resume_id},
        headers=_AUTH,
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"


def test_create_with_specific_resume_version() -> None:
    client, clients = _make(FakeProvider())
    resume_id = _import(client)
    versions = clients.service_client.table("resume_versions").rows
    version_id = versions[0]["id"]

    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions",
        json={
            "raw_text": _JD_TEXT,
            "resume_id": resume_id,
            "resume_version_id": version_id,
            "title": "Test",
        },
        headers=_AUTH,
    )

    assert response.status_code == 201
    assert response.json()["match"]["resume_version_id"] == version_id
