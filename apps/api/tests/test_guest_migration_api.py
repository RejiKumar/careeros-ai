"""Guest migration tests: transfer, idempotency and invalid identities."""

from __future__ import annotations

import uuid

from app.core.config import Settings
from app.integrations.supabase.client import get_supabase_clients
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient

from .fakes import FakeClients


def _make_client() -> tuple[TestClient, FakeClients]:
    fake = FakeClients()
    app = create_app(Settings(environment="dev"))
    app.dependency_overrides[get_supabase_clients] = lambda: fake
    return TestClient(app), fake


def _seed_guest_data(fake: FakeClients, guest_id: str) -> None:
    fake.service_client.table("guest_accounts").insert({"id": guest_id}).execute()
    for table in ("resumes", "job_descriptions", "assessments"):
        fake.service_client.table(table).insert({"guest_id": guest_id}).execute()


def test_migrate_guest_transfers_rows() -> None:
    client, fake = _make_client()
    guest_id = str(uuid.uuid4())
    _seed_guest_data(fake, guest_id)

    response = client.post(
        f"{API_V1_PREFIX}/auth/migrate-guest",
        headers={"Authorization": "Bearer good-token"},
        json={"guest_id": guest_id},
    )

    assert response.status_code == 200
    assert response.json()["migrated_records"] == 3
    for table in ("resumes", "job_descriptions", "assessments"):
        rows = fake.service_client._rows[table]
        assert rows[0]["user_id"] == "u-1"
        assert rows[0]["guest_id"] is None
    assert fake.service_client._rows["guest_accounts"] == []


def test_migrate_guest_is_idempotent() -> None:
    client, fake = _make_client()
    guest_id = str(uuid.uuid4())
    _seed_guest_data(fake, guest_id)

    first = client.post(
        f"{API_V1_PREFIX}/auth/migrate-guest",
        headers={"Authorization": "Bearer good-token"},
        json={"guest_id": guest_id},
    )
    assert first.status_code == 200

    second = client.post(
        f"{API_V1_PREFIX}/auth/migrate-guest",
        headers={"Authorization": "Bearer good-token"},
        json={"guest_id": guest_id},
    )
    assert second.status_code == 200
    assert second.json()["migrated_records"] == 0
    for table in ("resumes", "job_descriptions", "assessments"):
        assert fake.service_client._rows[table][0]["user_id"] == "u-1"


def test_migrate_guest_invalid_id_rejected() -> None:
    client, _ = _make_client()

    response = client.post(
        f"{API_V1_PREFIX}/auth/migrate-guest",
        headers={"Authorization": "Bearer good-token"},
        json={"guest_id": "not-a-uuid"},
    )

    assert response.status_code == 422


def test_migrate_guest_requires_auth() -> None:
    client, _ = _make_client()

    response = client.post(
        f"{API_V1_PREFIX}/auth/migrate-guest",
        json={"guest_id": str(uuid.uuid4())},
    )

    assert response.status_code == 401
