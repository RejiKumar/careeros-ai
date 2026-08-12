"""Auth endpoint tests: success, missing, invalid and expired token paths."""

from __future__ import annotations

import os
from collections.abc import Callable

import pytest
from app.core.config import Settings
from app.integrations.supabase.auth import (
    ERROR_CODE_EXPIRED,
    ERROR_CODE_INVALID,
    AuthVerificationError,
)
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from dotenv import load_dotenv
from fastapi.testclient import TestClient


class FakeClients(SupabaseClients):
    def __init__(self, verifier: Callable[[str], dict] | None = None) -> None:
        self._verifier = verifier
        self.anon_client = None  # type: ignore[assignment]
        self.service_client = None

    def verify_jwt(self, access_token: str) -> dict:
        if self._verifier is None:
            raise AuthVerificationError(ERROR_CODE_INVALID, "Access token is invalid.")
        return self._verifier(access_token)


def make_client(verifier: Callable[[str], dict] | None) -> TestClient:
    settings = Settings(environment="dev")
    app = create_app(settings)
    app.dependency_overrides[get_supabase_clients] = lambda: FakeClients(verifier)
    return TestClient(app)


def _claims(uid: str = "u-123") -> dict:
    return {"sub": uid, "email": "user@example.com", "role": "authenticated"}


def test_me_returns_current_user() -> None:
    client = make_client(lambda token: _claims() if token == "good-token" else None)

    response = client.get(
        f"{API_V1_PREFIX}/auth/me", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": "u-123",
        "email": "user@example.com",
        "role": "authenticated",
    }


def test_me_missing_token_returns_401() -> None:
    client = make_client(None)

    response = client.get(f"{API_V1_PREFIX}/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "missing_token"


def test_me_invalid_token_returns_401() -> None:
    client = make_client(None)

    response = client.get(f"{API_V1_PREFIX}/auth/me", headers={"Authorization": "Bearer bogus"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


def test_me_expired_token_returns_401() -> None:
    client = make_client(
        lambda _token: (_ for _ in ()).throw(
            AuthVerificationError(ERROR_CODE_EXPIRED, "Access token has expired.")
        )
    )

    response = client.get(
        f"{API_V1_PREFIX}/auth/me", headers={"Authorization": "Bearer expired-token"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_expired"
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.integration
def test_me_with_real_project_credentials() -> None:
    """Hits the configured Supabase project. Skips when not configured."""
    load_dotenv()
    email = os.getenv("AUTH_TEST_EMAIL")
    password = os.getenv("AUTH_TEST_PASSWORD")
    url = os.getenv("CAREEROS_SUPABASE_URL")
    if not (email and password and url):
        pytest.skip("Supabase integration env not configured")

    clients = SupabaseClients(
        Settings(
            supabase_url=url,
            supabase_anon_key=os.getenv("CAREEROS_SUPABASE_ANON_KEY", ""),
        )
    )
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: clients

    token = clients.anon_client.auth.sign_in_with_password(
        {"email": email, "password": password}
    ).session.access_token

    response = TestClient(app).get(
        f"{API_V1_PREFIX}/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["id"]
