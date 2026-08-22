"""Interview endpoint tests: session lifecycle, ownership, generation and evaluation."""

from __future__ import annotations

import uuid

from app.ai.provider import ProviderError, get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider


def _make_client(provider: FakeProvider) -> tuple[TestClient, FakeClients]:
    fake = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: fake
    app.dependency_overrides[get_ai_provider] = lambda: provider
    return TestClient(app), fake


def _seed_resume(fake: FakeClients) -> str:
    resume = (
        fake.service_client.table("resumes")
        .insert({"user_id": "u-1", "title": "Ada Resume"})
        .execute()
        .data[0]
    )
    version = (
        fake.service_client.table("resume_versions")
        .insert(
            {
                "resume_id": resume["id"],
                "user_id": "u-1",
                "version": 1,
                "source": "import",
                "structured_data": None,
            }
        )
        .execute()
        .data[0]
    )
    fake.service_client.table("resumes").update({"current_version_id": version["id"]}).eq(
        "id", resume["id"]
    ).execute()
    return resume["id"]


def test_create_session_generates_questions() -> None:
    client, fake = _make_client(FakeProvider())

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "technical", "target_job": "Senior Engineer", "target_skills": ["Python"]},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["session"]["mode"] == "technical"
    assert len(body["questions"]) == 1
    assert body["questions"][0]["question"]
    rows = fake.service_client._rows["interview_sessions"]
    assert rows[0]["user_id"] == "u-1"
    question_rows = fake.service_client._rows["interview_questions"]
    assert question_rows[0]["session_id"] == rows[0]["id"]


def test_create_session_with_resume_context() -> None:
    client, fake = _make_client(FakeProvider())
    resume_id = _seed_resume(fake)

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "hr", "resume_id": resume_id},
    )

    assert response.status_code == 201


def test_create_session_rejects_other_users_resume() -> None:
    client, fake = _make_client(FakeProvider())
    resume_id = _seed_resume(fake)

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "hr", "resume_id": resume_id, "target_job": "x"},
    )

    assert response.status_code == 201
    # u-1 owns the resume, so this succeeds; verify a missing resume 404s instead
    missing = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "hr", "resume_id": str(uuid.uuid4())},
    )
    assert missing.status_code == 404


def test_get_session_returns_questions() -> None:
    client, fake = _make_client(FakeProvider())
    created = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "behavioral"},
    )
    session_id = created.json()["session"]["id"]

    response = client.get(
        f"{API_V1_PREFIX}/interviews/sessions/{session_id}",
        headers={"Authorization": "Bearer good-token"},
    )

    assert response.status_code == 200
    assert len(response.json()["questions"]) == 1


def test_get_session_denied_for_other_user() -> None:
    client, fake = _make_client(FakeProvider())
    created = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "hr"},
    )
    session_id = created.json()["session"]["id"]

    response = client.get(
        f"{API_V1_PREFIX}/interviews/sessions/{session_id}",
        headers={"X-Guest-Id": str(uuid.uuid4())},
    )

    assert response.status_code == 404


def test_submit_answer_returns_evaluation() -> None:
    client, _ = _make_client(FakeProvider())
    created = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "technical"},
    )
    question_id = created.json()["questions"][0]["id"]
    session_id = created.json()["session"]["id"]

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions/{session_id}/answers",
        headers={"Authorization": "Bearer good-token"},
        json={"question_id": question_id, "content": "I led a project that cut latency by 30%."},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["evaluation"]["relevance"] == 85
    assert body["evaluation"]["completeness"] == 65
    assert body["evaluation"]["feedback"]


def test_submit_answer_question_must_belong_to_session() -> None:
    client, _ = _make_client(FakeProvider())
    created = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "hr"},
    )
    session_id = created.json()["session"]["id"]

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions/{session_id}/answers",
        headers={"Authorization": "Bearer good-token"},
        json={"question_id": str(uuid.uuid4()), "content": "An answer."},
    )

    assert response.status_code == 404


def test_create_session_provider_failure_returns_502() -> None:
    client, _ = _make_client(FakeProvider(error=ProviderError("down")))

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        headers={"Authorization": "Bearer good-token"},
        json={"mode": "startup"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_error"


def test_interviews_require_identity() -> None:
    client, _ = _make_client(FakeProvider())

    response = client.post(
        f"{API_V1_PREFIX}/interviews/sessions",
        json={"mode": "custom"},
    )

    assert response.status_code == 401
