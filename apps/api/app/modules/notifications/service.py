"""Push notification use cases: register FCM tokens, manage preferences, send notifications."""

from __future__ import annotations

import logging

from fastapi import status

from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import NotificationRepository
from .schema import (
    FCMTokenResponse,
    NotificationLogResponse,
    NotificationPreferenceResponse,
)

logger = logging.getLogger(__name__)

_DEFAULT_PREFERENCES: dict[str, object] = {
    "job_alerts": True,
    "mission_reminders": True,
    "career_tips": True,
    "frequency": "daily",
}


class FCMTokenRegistrationError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="fcm_token_error",
            message="Could not register FCM token. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class FCMTokenNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="FCM token not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class NotificationSendError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="notification_send_error",
            message="Could not send notification. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class NotificationNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Notification not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


def _send_fcm_message(
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    image_url: str | None = None,
) -> None:
    try:
        from firebase_admin import messaging

        messaging.send(
            messaging.Message(
                notification=messaging.Notification(title=title, body=body, image=image_url),
                token=token,
                data=data,
            )
        )
    except ImportError:
        logger.warning("firebase_admin is not installed; skipping push notification.")
    except Exception:
        logger.exception("Failed to send FCM message to token %s", token)


class NotificationService:
    def __init__(self, clients: SupabaseClients) -> None:
        service_client = require_service_client(clients)
        self._repository = NotificationRepository(service_client)

    def register_fcm_token(
        self,
        actor: CurrentActor,
        *,
        token: str,
        platform: str,
    ) -> FCMTokenResponse:
        try:
            row = self._repository.upsert_fcm_token(actor=actor, token=token, platform=platform)
        except Exception as exc:
            raise FCMTokenRegistrationError() from exc
        return _to_fcm_token_response(row)

    def remove_fcm_token(self, actor: CurrentActor, *, token: str) -> None:
        self._repository.delete_fcm_token(actor=actor, token=token)

    def update_preference(
        self,
        actor: CurrentActor,
        *,
        job_alerts: bool | None = None,
        mission_reminders: bool | None = None,
        career_tips: bool | None = None,
        frequency: str | None = None,
    ) -> NotificationPreferenceResponse:
        current = self._repository.get_preference(actor=actor)
        skip_keys = ("id", "user_id", "created_at", "updated_at")
        filtered = (
            {k: v for k, v in current.items() if k not in skip_keys}
            if current
            else {}
        )
        merged = {**_DEFAULT_PREFERENCES, **filtered}
        if job_alerts is not None:
            merged["job_alerts"] = job_alerts
        if mission_reminders is not None:
            merged["mission_reminders"] = mission_reminders
        if career_tips is not None:
            merged["career_tips"] = career_tips
        if frequency is not None:
            merged["frequency"] = frequency

        row = self._repository.upsert_preference(
            actor=actor,
            job_alerts=merged["job_alerts"],
            mission_reminders=merged["mission_reminders"],
            career_tips=merged["career_tips"],
            frequency=merged["frequency"],
        )
        return _to_preference_response(row)

    def get_preference(self, actor: CurrentActor) -> NotificationPreferenceResponse | None:
        row = self._repository.get_preference(actor=actor)
        return _to_preference_response(row) if row else None

    def send_notification(
        self,
        *,
        user_id: str,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
        image_url: str | None = None,
    ) -> None:
        tokens = self._repository.get_fcm_tokens(actor=CurrentActor(id=user_id, kind="user"))
        if not tokens:
            return
        for token_row in tokens:
            _send_fcm_message(
                token=token_row["token"],
                title=title,
                body=body,
                data=data,
                image_url=image_url,
            )
        self.log_notification(
            user_id=user_id, title=title, body=body, notification_type="push"
        )

    def log_notification(
        self,
        *,
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
    ) -> None:
        self._repository.log_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
        )

    def mark_notification_read(self, actor: CurrentActor, *, notification_id: str) -> None:
        self._repository.mark_read(actor=actor, notification_id=notification_id)

    def list_notifications(self, actor: CurrentActor) -> list[NotificationLogResponse]:
        rows = self._repository.list_notifications(actor=actor)
        return [_to_log_response(row) for row in rows]


def _to_fcm_token_response(row: dict) -> FCMTokenResponse:
    return FCMTokenResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id", ""),
        token=row["token"],
        platform=row["platform"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_preference_response(row: dict) -> NotificationPreferenceResponse:
    return NotificationPreferenceResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id", ""),
        job_alerts=row["job_alerts"],
        mission_reminders=row["mission_reminders"],
        career_tips=row["career_tips"],
        frequency=row["frequency"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_log_response(row: dict) -> NotificationLogResponse:
    return NotificationLogResponse(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        body=row["body"],
        type=row["type"],
        sent_at=row["sent_at"],
        read_at=row.get("read_at"),
    )
