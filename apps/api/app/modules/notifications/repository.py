"""Notification persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_column, owner_eq, owner_fields

FCM_TOKENS_TABLE = "fcm_tokens"
NOTIFICATION_PREFS_TABLE = "notification_preferences"
NOTIFICATION_LOGS_TABLE = "notification_logs"
APPLICATIONS_TABLE = "applications"
MISSIONS_TABLE = "missions"
MISSION_COMPLETIONS_TABLE = "mission_completions"


class NotificationRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def upsert_fcm_token(
        self,
        *,
        actor: CurrentActor,
        token: str,
        platform: str,
    ) -> dict:
        existing = (
            self._client.table(FCM_TOKENS_TABLE)
            .select("id")
            .eq("token", token)
            .eq("user_id" if actor.kind == "user" else "guest_id", actor.id)
            .execute()
            .data
        )
        if existing:
            rows = (
                self._client.table(FCM_TOKENS_TABLE)
                .update({"platform": platform, "token": token})
                .eq("id", existing[0]["id"])
                .execute()
                .data
            )
            return rows[0]
        rows = (
            self._client.table(FCM_TOKENS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "token": token,
                    "platform": platform,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def get_fcm_tokens(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(FCM_TOKENS_TABLE).select("*")
        return owner_eq(query, actor).execute().data

    def delete_fcm_token(self, *, actor: CurrentActor, token: str) -> None:
        query = self._client.table(FCM_TOKENS_TABLE).delete().eq("token", token)
        owner_eq(query, actor).execute()

    def upsert_preference(
        self,
        *,
        actor: CurrentActor,
        job_alerts: bool,
        mission_reminders: bool,
        career_tips: bool,
        frequency: str,
    ) -> dict:
        existing = (
            self._client.table(NOTIFICATION_PREFS_TABLE)
            .select("id")
            .eq("user_id" if actor.kind == "user" else "guest_id", actor.id)
            .execute()
            .data
        )
        payload = {
            "job_alerts": job_alerts,
            "mission_reminders": mission_reminders,
            "career_tips": career_tips,
            "frequency": frequency,
        }
        if existing:
            rows = (
                self._client.table(NOTIFICATION_PREFS_TABLE)
                .update(payload)
                .eq("id", existing[0]["id"])
                .execute()
                .data
            )
            return rows[0]
        rows = (
            self._client.table(NOTIFICATION_PREFS_TABLE)
            .insert({**owner_fields(actor), **payload})
            .execute()
            .data
        )
        return rows[0]

    def get_preference(self, *, actor: CurrentActor) -> dict | None:
        query = self._client.table(NOTIFICATION_PREFS_TABLE).select("*")
        rows = owner_eq(query, actor).execute().data
        return rows[0] if rows else None

    def log_notification(
        self,
        *,
        actor: CurrentActor,
        title: str,
        body: str,
        notification_type: str,
    ) -> dict:
        rows = (
            self._client.table(NOTIFICATION_LOGS_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "title": title,
                    "body": body,
                    "type": notification_type,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def mark_read(self, *, actor: CurrentActor, notification_id: str) -> None:
        query = (
            self._client.table(NOTIFICATION_LOGS_TABLE)
            .update({"read_at": datetime.now(UTC).isoformat()})
            .eq("id", notification_id)
        )
        owner_eq(query, actor).execute()

    def list_notifications(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(NOTIFICATION_LOGS_TABLE).select("*")
        return owner_eq(query, actor).order("sent_at", desc=True).execute().data

    # ─── Scheduler reads (service-role; bypass RLS) ───

    def list_preference_rows(self) -> list[dict]:
        return self._client.table(NOTIFICATION_PREFS_TABLE).select("*").execute().data

    def list_fcm_tokens_for_owner(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(FCM_TOKENS_TABLE).select("token")
        return owner_eq(query, actor).execute().data

    def list_applications_due(
        self, *, owner_type: str, owner_id: str, today_iso: str
    ) -> list[dict]:
        query = self._client.table(APPLICATIONS_TABLE).select("*").eq(owner_type, owner_id)
        return query.execute().data

    def has_active_missions(self) -> bool:
        rows = self._client.table(MISSIONS_TABLE).select("id").eq("is_active", True).execute().data
        return bool(rows)

    def completed_any_today(self, *, actor: CurrentActor, today_iso: str) -> bool:
        query = (
            self._client.table(MISSION_COMPLETIONS_TABLE)
            .select("id")
            .eq(owner_column(actor), actor.id)
            .eq("completed_on", today_iso)
        )
        return bool(query.execute().data)

    def has_logged_today(
        self, *, actor: CurrentActor, notification_type: str, today_iso: str
    ) -> bool:
        query = (
            self._client.table(NOTIFICATION_LOGS_TABLE)
            .select("id", "sent_at")
            .eq(owner_column(actor), actor.id)
            .eq("type", notification_type)
        )
        rows = query.execute().data
        return any(str(row.get("sent_at", ""))[:10] == today_iso for row in rows)
