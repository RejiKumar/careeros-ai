"""AI response-locale tests: the Accept-Language header reaches the provider.

The locale only shapes free-text response language. Resume extraction never
takes a locale because resume facts must never be translated.
"""

from __future__ import annotations

from app.ai.provider import get_ai_provider
from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients, FakeProvider

_AUTH = {"Authorization": "Bearer good-token"}
_RESUME_BYTES = b"Ada Lovelace\nMathematician\nSkills: Python, SQL\n"


def _make() -> tuple[TestClient, FakeProvider]:
    provider = FakeProvider()
    clients = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients
    app.dependency_overrides[get_ai_provider] = lambda: provider
    return TestClient(app), provider


def _import_and_assess(client: TestClient, headers: dict | None = None) -> None:
    import_response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    )
    assert import_response.status_code == 201
    resume_id = import_response.json()["resume"]["id"]
    headers = headers or {}
    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/assessments",
        headers={**_AUTH, **headers},
    )
    assert response.status_code == 201


def test_explicit_english_locale_reaches_provider() -> None:
    client, provider = _make()
    _import_and_assess(client, {"Accept-Language": "en"})
    _, locale = provider.assess_calls[0]
    assert locale == "en"


def test_region_locale_normalizes_to_base() -> None:
    client, provider = _make()
    _import_and_assess(client, {"Accept-Language": "en-US, en;q=0.9"})
    _, locale = provider.assess_calls[0]
    assert locale == "en"


def test_unsupported_locale_falls_back_to_default() -> None:
    client, provider = _make()
    _import_and_assess(client, {"Accept-Language": "fr-FR, fr;q=0.9"})
    _, locale = provider.assess_calls[0]
    assert locale == "en"


def test_missing_header_defaults_to_english() -> None:
    client, provider = _make()
    _import_and_assess(client)
    _, locale = provider.assess_calls[0]
    assert locale == "en"


def test_job_match_receives_locale() -> None:
    client, provider = _make()
    import_response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    )
    resume_id = import_response.json()["resume"]["id"]
    response = client.post(
        f"{API_V1_PREFIX}/job-descriptions",
        json={"raw_text": "Senior Python engineer.", "resume_id": resume_id},
        headers={**_AUTH, "Accept-Language": "en-GB"},
    )
    assert response.status_code == 201
    _, _, locale = provider.match_calls[0]
    assert locale == "en"


def test_coach_message_receives_locale() -> None:
    client, provider = _make()
    thread = client.post(
        f"{API_V1_PREFIX}/coach/threads",
        json={"title": "Career chat"},
        headers=_AUTH,
    )
    thread_id = thread.json()["id"]
    response = client.post(
        f"{API_V1_PREFIX}/coach/threads/{thread_id}/messages",
        json={"content": "How do I grow?"},
        headers={**_AUTH, "Accept-Language": "en-US"},
    )
    assert response.status_code == 201
    _, _, locale = provider.coach_calls[0]
    assert locale == "en"


def test_rewrites_receive_locale() -> None:
    client, provider = _make()
    import_response = client.post(
        f"{API_V1_PREFIX}/resumes/import",
        files={"file": ("resume.txt", _RESUME_BYTES, "text/plain")},
        headers=_AUTH,
    )
    resume_id = import_response.json()["resume"]["id"]
    response = client.post(
        f"{API_V1_PREFIX}/resumes/{resume_id}/rewrites",
        headers={**_AUTH, "Accept-Language": "en"},
    )
    assert response.status_code == 201
    _, locale = provider.rewrite_calls[0]
    assert locale == "en"
