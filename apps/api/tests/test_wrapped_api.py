"""Wrapped endpoint tests: aggregation, ownership and empty-data responses."""

from __future__ import annotations

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


def _seed_data(fake: FakeClients) -> None:
    fake.service_client.table("assessments").insert(
        {
            "user_id": "u-1",
            "status": "completed",
            "scores": [
                {"dimension": "impact", "score": 80, "explanation": None},
                {"dimension": "clarity", "score": 60, "explanation": None},
            ],
            "gaps": [{"description": "No measurable outcomes.", "suggestion": None}],
        }
    ).execute()
    fake.service_client.table("job_matches").insert(
        {
            "user_id": "u-1",
            "job_description_id": "jd-1",
            "resume_version_id": "v-1",
            "score": 65,
            "matched_skills": ["Python"],
        }
    ).execute()
    fake.service_client.table("mission_completions").insert(
        {"user_id": "u-1", "mission_id": "m-1", "xp_awarded": 50}
    ).execute()
    fake.service_client.table("achievements").insert(
        {"key": "resume_master", "title": "Resume Master", "description": "First score."}
    ).execute()


def test_wrapped_aggregates_user_data() -> None:
    client, fake = _make_client()
    _seed_data(fake)
    achievement_id = fake.service_client._rows["achievements"][0]["id"]
    fake.service_client.table("user_achievements").insert(
        {"user_id": "u-1", "achievement_id": achievement_id}
    ).execute()

    response = client.get(
        f"{API_V1_PREFIX}/wrapped", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200
    body = response.json()
    by_key = {point["key"]: point for point in body["data_points"]}
    assert by_key["health_score"]["value"] == "70"
    assert by_key["strongest_skill"]["value"] == "Python"
    assert "Level" in by_key["career_level"]["value"]
    assert by_key["biggest_opportunity"]["value"] == "No measurable outcomes."
    assert body["achievements"][0]["title"] == "Resume Master"


def test_wrapped_empty_data_response() -> None:
    client, _ = _make_client()

    response = client.get(
        f"{API_V1_PREFIX}/wrapped", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200
    body = response.json()
    by_key = {point["key"]: point for point in body["data_points"]}
    assert by_key["health_score"]["available"] is False
    assert by_key["strongest_skill"]["available"] is False
    assert body["achievements"] == []


def test_wrapped_requires_identity() -> None:
    client, _ = _make_client()

    response = client.get(f"{API_V1_PREFIX}/wrapped")

    assert response.status_code == 401


def test_wrapped_guest_gets_basic_data() -> None:
    import uuid

    client, fake = _make_client()
    guest_id = str(uuid.uuid4())
    fake.service_client.table("assessments").insert(
        {
            "guest_id": guest_id,
            "status": "completed",
            "scores": [{"dimension": "impact", "score": 88, "explanation": None}],
            "gaps": [],
        }
    ).execute()

    response = client.get(
        f"{API_V1_PREFIX}/wrapped", headers={"X-Guest-Id": guest_id}
    )

    assert response.status_code == 200
    body = response.json()
    by_key = {point["key"]: point for point in body["data_points"]}
    assert by_key["health_score"]["value"] == "88"
    assert "career_level" not in by_key
