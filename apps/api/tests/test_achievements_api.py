"""Achievements tests: award conditions, idempotency and streak logic."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

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


def _seed_achievements(fake: FakeClients) -> dict[str, str]:
    keys = {}
    for key, title, condition in [
        ("ats_warrior", "ATS Warrior", "assessment_score_gte_80"),
        ("resume_master", "Resume Master", "first_assessment"),
        ("interview_ready", "Interview Ready", "first_interview"),
        ("streak_7", "7-Day Streak", "streak_days_gte_7"),
        ("perfect_score", "Perfect Score", "assessment_score_gte_95"),
    ]:
        row = fake.service_client.table("achievements").insert(
            {
                "key": key,
                "title": title,
                "description": "Test description",
                "condition": condition,
            }
        ).execute().data[0]
        keys[key] = row["id"]
    return keys


def _seed_assessment(fake: FakeClients, scores: list[int]) -> None:
    fake.service_client.table("assessments").insert(
        {
            "user_id": "u-1",
            "status": "completed",
            "scores": [{"dimension": "d", "score": score, "explanation": None} for score in scores],
            "gaps": [],
        }
    ).execute()


def test_dashboard_includes_achievements() -> None:
    client, fake = _make_client()
    _seed_achievements(fake)

    response = client.get(
        f"{API_V1_PREFIX}/dashboard", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200
    achievements = response.json()["achievements"]
    assert len(achievements) == 5
    assert all(item["earned_at"] is None for item in achievements)


def test_get_achievements_lists_all() -> None:
    client, fake = _make_client()
    _seed_achievements(fake)

    response = client.get(
        f"{API_V1_PREFIX}/achievements", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200
    keys = {item["key"] for item in response.json()}
    assert keys == {"ats_warrior", "resume_master", "interview_ready", "streak_7", "perfect_score"}


def test_mission_completion_awards_streak_7_after_seven_days() -> None:
    client, fake = _make_client()
    achievement_ids = _seed_achievements(fake)
    mission = fake.service_client.table("missions").insert(
        {
            "key": "daily_review",
            "title": "Daily review",
            "xp_reward": 10,
            "cadence": "daily",
            "is_active": True,
        }
    ).execute().data[0]

    today = datetime.now(tz=UTC).date()
    for days_ago in range(7, 0, -1):
        fake.service_client.table("mission_completions").insert(
            {
                "user_id": "u-1",
                "mission_id": mission["id"],
                "completed_on": (today - timedelta(days=days_ago)).isoformat(),
                "xp_awarded": 10,
            }
        ).execute()

    response = client.post(
        f"{API_V1_PREFIX}/missions/daily_review/complete",
        headers={"Authorization": "Bearer good-token"},
    )

    assert response.status_code == 201
    earned = fake.service_client._rows["user_achievements"]
    earned_keys = {row["achievement_id"] for row in earned}
    assert achievement_ids["streak_7"] in earned_keys


def test_achievement_award_is_idempotent() -> None:
    client, fake = _make_client()
    achievement_ids = _seed_achievements(fake)
    _seed_assessment(fake, scores=[70])

    fake.service_client.table("missions").insert(
        {
            "key": "daily_review",
            "title": "Daily review",
            "xp_reward": 10,
            "cadence": "daily",
            "is_active": True,
        }
    ).execute()

    first = client.post(
        f"{API_V1_PREFIX}/missions/daily_review/complete",
        headers={"Authorization": "Bearer good-token"},
    )
    assert first.status_code == 201
    second = client.post(
        f"{API_V1_PREFIX}/missions/daily_review/complete",
        headers={"Authorization": "Bearer good-token"},
    )
    assert second.status_code == 201

    earned_rows = [
        row
        for row in fake.service_client._rows["user_achievements"]
        if row["achievement_id"] == achievement_ids["resume_master"]
    ]
    assert len(earned_rows) == 1


def test_high_score_awards_ats_warrior_and_perfect_score() -> None:
    client, fake = _make_client()
    achievement_ids = _seed_achievements(fake)
    _seed_assessment(fake, scores=[96])

    fake.service_client.table("missions").insert(
        {
            "key": "daily_review",
            "title": "Daily review",
            "xp_reward": 10,
            "cadence": "daily",
            "is_active": True,
        }
    ).execute()
    client.post(
        f"{API_V1_PREFIX}/missions/daily_review/complete",
        headers={"Authorization": "Bearer good-token"},
    )

    earned = {row["achievement_id"] for row in fake.service_client._rows["user_achievements"]}
    assert achievement_ids["resume_master"] in earned
    assert achievement_ids["ats_warrior"] in earned
    assert achievement_ids["perfect_score"] in earned
