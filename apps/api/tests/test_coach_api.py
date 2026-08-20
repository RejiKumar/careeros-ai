"""Coach API tests using in-memory fakes."""

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


def _create_thread(client: TestClient, resume_id: str | None = None) -> httpx.Response:
    payload: dict = {"title": "Career chat"}
    if resume_id is not None:
        payload["resume_id"] = resume_id
    return client.post(f"{API_V1_PREFIX}/coach/threads", json=payload, headers=_AUTH)


def test_create_thread_succeeds() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = _create_thread(client)

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Career chat"
    assert data["resume_id"] is None
    assert data["id"]


def test_create_thread_with_resume_links_context() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    resume_id = _import(client)

    response = _create_thread(client, resume_id=resume_id)

    assert response.status_code == 201
    assert response.json()["resume_id"] == resume_id


def test_create_thread_with_other_resume_is_not_found() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = _create_thread(client, resume_id="resume-other-user")

    assert response.status_code == 404


def test_create_thread_requires_authentication() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = client.post(f"{API_V1_PREFIX}/coach/threads", json={"title": "x"})

    assert response.status_code == 401


def test_send_message_succeeds_with_resume_context() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    resume_id = _import(client)
    thread_id = _create_thread(client, resume_id=resume_id).json()["id"]

    response = client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "How do I improve my bullets?"},
        headers=_AUTH,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user_message"]["role"] == "user"
    assert data["user_message"]["content"] == "How do I improve my bullets?"
    assert data["assistant_message"]["role"] == "assistant"
    assert data["assistant_message"]["content"].startswith("Focus on concrete")
    assert provider.coach_calls
    _, resume_context, locale = provider.coach_calls[0]
    assert resume_context is not None and "Ada Lovelace" in resume_context


def test_send_message_without_resume_context_passes_none() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    response = client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "Plan my week."},
        headers=_AUTH,
    )

    assert response.status_code == 201
    _, resume_context, locale = provider.coach_calls[0]
    assert resume_context is None


def test_send_message_keeps_history() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "First question."},
        headers=_AUTH,
    )
    client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "Second question."},
        headers=_AUTH,
    )

    messages, _, locale = provider.coach_calls[-1]
    contents = [message.content for message in messages]
    assert "First question." in contents
    assert "Second question." in contents
    assert contents.count("Second question.") == 1


def test_send_message_other_user_thread_is_not_found() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = client.post(
        f"{API_V1_PREFIX}/coach/threads/thread-other-user/messages",
        json={"content": "Hi"},
        headers=_AUTH,
    )

    assert response.status_code == 404


def test_send_message_empty_content_is_rejected() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    response = client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": " "},
        headers=_AUTH,
    )

    assert response.status_code == 422


def test_send_message_provider_failure_returns_502_and_saves_user_message() -> None:
    provider = FakeProvider(error=ProviderError("boom"))
    client, clients = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    response = client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "Ask away."},
        headers=_AUTH,
    )

    assert response.status_code == 502
    saved = clients.service_client._rows["coach_messages"]
    assert [row["role"] for row in saved] == ["user"]
    assert saved[0]["content"] == "Ask away."


def test_get_thread_detail_returns_messages_in_order() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "Question."},
        headers=_AUTH,
    )

    response = client.get(f"{API_V1_PREFIX}/coach/threads/{thread_id}", headers=_AUTH)

    assert response.status_code == 200
    data = response.json()
    assert data["thread"]["id"] == thread_id
    assert [message["role"] for message in data["messages"]] == ["user", "assistant"]


def test_get_thread_detail_other_user_is_not_found() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = client.get(f"{API_V1_PREFIX}/coach/threads/thread-other-user", headers=_AUTH)

    assert response.status_code == 404


def test_list_threads_returns_own_threads() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    first = _create_thread(client, resume_id=None).json()["id"]

    response = client.get(f"{API_V1_PREFIX}/coach/threads", headers=_AUTH)

    assert response.status_code == 200
    assert [thread["id"] for thread in response.json()] == [first]


def test_create_thread_with_job_description_context() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    resume_id = _import(client)

    response = client.post(
        f"{API_V1_PREFIX}/coach/threads",
        json={"title": "Chat", "resume_id": resume_id, "job_description_id": "jd-1"},
        headers=_AUTH,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["resume_id"] == resume_id
    assert data["job_description_id"] == "jd-1"


def test_update_thread_renames() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    response = client.patch(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}",
        json={"title": "Updated title"},
        headers=_AUTH,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"


def test_update_thread_adds_context() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    resume_id = _import(client)
    thread_id = _create_thread(client).json()["id"]

    response = client.patch(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}",
        json={"resume_id": resume_id, "job_description_id": "jd-1"},
        headers=_AUTH,
    )

    assert response.status_code == 200
    assert response.json()["resume_id"] == resume_id
    assert response.json()["job_description_id"] == "jd-1"


def test_update_thread_unknown_is_not_found() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = client.patch(
        f"{API_V1_PREFIX}/coach/threads/unknown",
        json={"title": "x"},
        headers=_AUTH,
    )

    assert response.status_code == 404


def test_delete_thread_removes_thread_and_cascades_messages() -> None:
    provider = FakeProvider()
    client, clients = _make(provider)
    thread_id = _create_thread(client).json()["id"]
    client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "Hello"},
        headers=_AUTH,
    )

    response = client.delete(f"{API_V1_PREFIX}/coach/threads/{thread_id}", headers=_AUTH)

    assert response.status_code == 204
    assert clients.service_client.table("coach_threads").rows == []
    assert clients.service_client.table("coach_messages").rows == []


def test_delete_thread_unknown_is_not_found() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)

    response = client.delete(f"{API_V1_PREFIX}/coach/threads/unknown", headers=_AUTH)

    assert response.status_code == 404


def test_get_thread_detail_pagination() -> None:
    provider = FakeProvider()
    client, _ = _make(provider)
    thread_id = _create_thread(client).json()["id"]

    for i in range(3):
        client.post(
            f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
            json={"content": f"Q{i}"},
            headers=_AUTH,
        )

    response = client.get(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}?limit=2&offset=0",
        headers=_AUTH,
    )

    assert response.status_code == 200
    data = response.json()
    # 3 user + 3 assistant = 6 messages; limit 2 returns 2
    assert len(data["messages"]) == 2


def test_guest_create_thread_and_message() -> None:
    """Guests can create coach threads and send messages under their own id."""
    import uuid

    provider = FakeProvider()
    client, clients = _make(provider)
    guest_id = str(uuid.uuid4())
    headers = {"X-Guest-Id": guest_id}

    created = client.post(
        f"{API_V1_PREFIX}/coach/threads", json={"title": "Guest chat"}, headers=headers
    )
    assert created.status_code == 201
    thread_id = created.json()["id"]
    assert clients.service_client._rows["guest_accounts"]  # ensure_guest_account ran

    listed = client.get(f"{API_V1_PREFIX}/coach/threads", headers=headers)
    assert listed.status_code == 200
    assert [t["id"] for t in listed.json()] == [thread_id]

    reply = client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "What should I improve?"},
        headers=headers,
    )
    assert reply.status_code == 201
    assert reply.json()["assistant_message"]["content"]

    messages = clients.service_client._rows["coach_messages"]
    assert all(row.get("guest_id") == guest_id for row in messages)
    assert all(row.get("user_id") is None for row in messages)


def test_guest_cannot_access_other_guest_thread() -> None:
    import uuid

    provider = FakeProvider()
    client, _ = _make(provider)
    guest_a = str(uuid.uuid4())
    guest_b = str(uuid.uuid4())

    created = client.post(
        f"{API_V1_PREFIX}/coach/threads",
        json={"title": "Private"},
        headers={"X-Guest-Id": guest_a},
    )
    assert created.status_code == 201
    thread_id = created.json()["id"]

    detail = client.get(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}", headers={"X-Guest-Id": guest_b}
    )
    assert detail.status_code == 404