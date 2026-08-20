"""RLS ownership tests against the live Supabase project.

Creates two throwaway users, then verifies allowed/denied ownership for the
main data tables and the private resumes storage bucket. Skips unless the
Supabase integration env is configured.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("CAREEROS_SUPABASE_URL", "")
ANON_KEY = os.getenv("CAREEROS_SUPABASE_ANON_KEY", "")
SERVICE_ROLE_KEY = os.getenv("CAREEROS_SUPABASE_SERVICE_ROLE_KEY", "")

_REQUIRED_ENV = bool(SUPABASE_URL and ANON_KEY and SERVICE_ROLE_KEY)
_PASSWORD = "careeros-test-123456"


@dataclass
class _TestUsers:
    a_id: str
    b_id: str
    a_token: str
    b_token: str


def _rest_headers(token: str) -> dict[str, str]:
    return {"apikey": ANON_KEY, "Authorization": f"Bearer {token}"}


def _service_headers() -> dict[str, str]:
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }


def _sign_in(email: str) -> str:
    response = httpx.post(
        f"{SUPABASE_URL}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": ANON_KEY},
        json={"email": email, "password": _PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _create_user(suffix: str) -> tuple[str, str]:
    email = f"rls-{suffix}-{uuid.uuid4().hex[:12]}@careeros.test"
    response = httpx.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=_service_headers(),
        json={"email": email, "password": _PASSWORD, "email_confirm": True},
        timeout=30,
    )
    assert response.status_code in (200, 201), response.text
    body = response.json()
    return body["id"], body["email"]


def _delete_user(user_id: str) -> None:
    httpx.delete(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers=_service_headers(),
        timeout=30,
    )


def _delete_storage_folder(user_id: str) -> None:
    httpx.delete(
        f"{SUPABASE_URL}/storage/v1/object/resumes/{user_id}",
        headers=_service_headers(),
        timeout=30,
    )


def _cleanup_orphans() -> None:
    """Remove leftover rls-* users from aborted runs."""
    response = httpx.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=_service_headers(),
        params={"per_page": 1000},
        timeout=30,
    )
    if response.status_code != 200:
        return
    for user in response.json().get("users", []):
        if user.get("email", "").startswith("rls-"):
            _delete_user(user["id"])


@pytest.fixture(scope="module")
def users() -> _TestUsers:
    if not _REQUIRED_ENV:
        pytest.skip("Supabase integration env not configured")
    _cleanup_orphans()
    a_id, a_email = _create_user("a")
    b_id, b_email = _create_user("b")
    try:
        a_token = _sign_in(a_email)
        b_token = _sign_in(b_email)
    except AssertionError:
        _delete_user(a_id)
        _delete_user(b_id)
        raise
    return _TestUsers(a_id=a_id, b_id=b_id, a_token=a_token, b_token=b_token)


@pytest.fixture(scope="module", autouse=True)
def _cleanup(users: _TestUsers) -> object:
    yield
    _delete_storage_folder(users.a_id)
    _delete_storage_folder(users.b_id)
    _delete_user(users.a_id)
    _delete_user(users.b_id)


def test_anonymous_requests_are_rejected(users: _TestUsers) -> None:
    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers={"apikey": ANON_KEY},
        timeout=30,
    )
    assert response.status_code == 200
    assert response.json() == []


def test_profile_ownership_allowed_and_denied(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    b_headers = _rest_headers(users.b_token)

    created = httpx.post(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers={**a_headers, "Prefer": "return=representation"},
        json={"user_id": users.a_id, "display_name": "User A"},
        timeout=30,
    )
    assert created.status_code == 201, created.text
    profile_id = created.json()[0]["id"]

    own = httpx.get(
        f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{profile_id}",
        headers=a_headers,
        timeout=30,
    )
    assert own.status_code == 200
    assert len(own.json()) == 1

    other = httpx.get(
        f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{profile_id}",
        headers=b_headers,
        timeout=30,
    )
    assert other.status_code == 200
    assert other.json() == []

    tamper = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{profile_id}",
        headers=b_headers,
        json={"display_name": "Hacked"},
        timeout=30,
    )
    assert tamper.status_code in (200, 204)

    still_mine = httpx.get(
        f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{profile_id}",
        headers=a_headers,
        timeout=30,
    )
    assert still_mine.json()[0]["display_name"] == "User A"


def test_usage_events_reject_client_inserts(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    blocked = httpx.post(
        f"{SUPABASE_URL}/rest/v1/usage_events",
        headers=a_headers,
        json={"user_id": users.a_id, "feature": "coach", "event_key": "client-spoof"},
        timeout=30,
    )
    assert blocked.status_code == 403

    allowed = httpx.post(
        f"{SUPABASE_URL}/rest/v1/usage_events",
        headers=_service_headers(),
        json={"user_id": users.a_id, "feature": "coach", "event_key": "test"},
        timeout=30,
    )
    assert allowed.status_code == 201, allowed.text

    visible = httpx.get(
        f"{SUPABASE_URL}/rest/v1/usage_events?user_id=eq.{users.a_id}",
        headers=a_headers,
        timeout=30,
    )
    assert visible.status_code == 200
    assert len(visible.json()) == 1


def test_entitlements_reject_client_inserts(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    blocked = httpx.post(
        f"{SUPABASE_URL}/rest/v1/entitlements",
        headers=a_headers,
        json={"user_id": users.a_id, "plan": "pro"},
        timeout=30,
    )
    assert blocked.status_code == 403


def test_mission_completions_ownership(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    b_headers = _rest_headers(users.b_token)

    seeded = httpx.post(
        f"{SUPABASE_URL}/rest/v1/missions",
        headers={**_service_headers(), "Prefer": "return=representation"},
        json={"key": f"test-{uuid.uuid4().hex[:8]}", "title": "Test mission"},
        timeout=30,
    )
    assert seeded.status_code == 201, seeded.text
    mission_id = seeded.json()[0]["id"]

    try:
        missions = httpx.get(
            f"{SUPABASE_URL}/rest/v1/missions?select=id&id=eq.{mission_id}",
            headers=a_headers,
            timeout=30,
        )
        assert missions.status_code == 200, missions.text
        assert [m["id"] for m in missions.json()] == [mission_id]

        created = httpx.post(
            f"{SUPABASE_URL}/rest/v1/mission_completions",
            headers=a_headers,
            json={"user_id": users.a_id, "mission_id": mission_id, "xp_awarded": 10},
            timeout=30,
        )
        assert created.status_code == 201, created.text

        b_denied = httpx.get(
            f"{SUPABASE_URL}/rest/v1/mission_completions?mission_id=eq.{mission_id}",
            headers=b_headers,
            timeout=30,
        )
        assert b_denied.status_code == 200
        assert b_denied.json() == []

        a_own = httpx.get(
            f"{SUPABASE_URL}/rest/v1/mission_completions?user_id=eq.{users.a_id}",
            headers=a_headers,
            timeout=30,
        )
        assert a_own.status_code == 200
        assert len(a_own.json()) == 1
    finally:
        httpx.delete(
            f"{SUPABASE_URL}/rest/v1/missions?id=eq.{mission_id}",
            headers=_service_headers(),
            timeout=30,
        )


def test_storage_folder_isolation(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    b_headers = _rest_headers(users.b_token)
    own_path = f"{users.a_id}/resume.pdf"
    content = b"%PDF-1.4 test"

    uploaded = httpx.put(
        f"{SUPABASE_URL}/storage/v1/object/resumes/{own_path}",
        headers={**a_headers, "Content-Type": "application/pdf"},
        content=content,
        timeout=30,
    )
    assert uploaded.status_code == 200, uploaded.text

    own_download = httpx.get(
        f"{SUPABASE_URL}/storage/v1/object/resumes/{own_path}",
        headers=a_headers,
        timeout=30,
    )
    assert own_download.status_code == 200

    denied_download = httpx.get(
        f"{SUPABASE_URL}/storage/v1/object/resumes/{own_path}",
        headers=b_headers,
        timeout=30,
    )
    assert denied_download.status_code in (400, 401, 403, 404)

    denied_upload = httpx.put(
        f"{SUPABASE_URL}/storage/v1/object/resumes/{own_path}",
        headers={**b_headers, "Content-Type": "application/pdf"},
        content=b"%PDF-1.4 evil",
        timeout=30,
    )
    assert denied_upload.status_code in (400, 401, 403)


def test_feedback_ownership_allowed_and_denied(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    b_headers = _rest_headers(users.b_token)

    created = httpx.post(
        f"{SUPABASE_URL}/rest/v1/feedback",
        headers={**a_headers, "Prefer": "return=representation"},
        json={
            "output_type": "assessment",
            "output_id": "assessment-x",
            "rating": "helpful",
            "user_id": users.a_id,
        },
        timeout=30,
    )
    assert created.status_code == 201, created.text

    b_denied = httpx.get(
        f"{SUPABASE_URL}/rest/v1/feedback?output_type=eq.assessment&output_id=eq.assessment-x",
        headers=b_headers,
        timeout=30,
    )
    assert b_denied.status_code == 200
    assert b_denied.json() == []

    a_own = httpx.get(
        f"{SUPABASE_URL}/rest/v1/feedback?output_type=eq.assessment&output_id=eq.assessment-x",
        headers=a_headers,
        timeout=30,
    )
    assert a_own.status_code == 200
    assert len(a_own.json()) == 1
    assert a_own.json()[0]["rating"] == "helpful"

    updated = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/feedback?output_type=eq.assessment&output_id=eq.assessment-x",
        headers=a_headers,
        json={"rating": "not_helpful", "reason": "too_generic"},
        timeout=30,
    )
    assert updated.status_code in (200, 204), updated.text

    after_update = httpx.get(
        f"{SUPABASE_URL}/rest/v1/feedback?output_type=eq.assessment&output_id=eq.assessment-x",
        headers=a_headers,
        timeout=30,
    )
    assert after_update.json()[0]["rating"] == "not_helpful"


def test_achievements_seeded_and_user_achievements_owned(users: _TestUsers) -> None:
    a_headers = _rest_headers(users.a_token)
    b_headers = _rest_headers(users.b_token)

    listed = httpx.get(
        f"{SUPABASE_URL}/rest/v1/achievements?select=id,key",
        headers=a_headers,
        timeout=30,
    )
    assert listed.status_code == 200
    keys = {row["key"] for row in listed.json()}
    assert {"ats_warrior", "resume_master", "interview_ready", "streak_7", "perfect_score"} <= keys

    achievement_id = next(row["id"] for row in listed.json() if row["key"] == "resume_master")
    earned = httpx.post(
        f"{SUPABASE_URL}/rest/v1/user_achievements",
        headers={**a_headers, "Prefer": "return=representation"},
        json={"user_id": users.a_id, "achievement_id": achievement_id},
        timeout=30,
    )
    assert earned.status_code == 201, earned.text

    b_denied = httpx.get(
        f"{SUPABASE_URL}/rest/v1/user_achievements?achievement_id=eq.{achievement_id}",
        headers=b_headers,
        timeout=30,
    )
    assert b_denied.status_code == 200
    assert b_denied.json() == []


def test_guest_rows_are_not_publicly_readable() -> None:
    guest_id = str(uuid.uuid4())
    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/guest_accounts?id=eq.{guest_id}",
        headers={"apikey": ANON_KEY},
        timeout=30,
    )
    assert response.status_code == 200
    assert response.json() == []

    client_insert = httpx.post(
        f"{SUPABASE_URL}/rest/v1/guest_accounts",
        headers={"apikey": ANON_KEY},
        json={"id": guest_id},
        timeout=30,
    )
    assert client_insert.status_code in (401, 403)
