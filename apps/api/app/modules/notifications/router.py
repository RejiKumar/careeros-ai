"""Notifications router: thin HTTP layer over the notification service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    FCMTokenRequest,
    FCMTokenResponse,
    NotificationLogResponse,
    NotificationPreferenceRequest,
    NotificationPreferenceResponse,
    SendNotificationRequest,
)
from .service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_notification_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
) -> NotificationService:
    return NotificationService(clients)


@router.post("/fcm-token", response_model=FCMTokenResponse, status_code=201)
def register_fcm_token(
    payload: FCMTokenRequest,
    service: Annotated[NotificationService, Depends(get_notification_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> FCMTokenResponse:
    return service.register_fcm_token(actor, token=payload.token, platform=payload.platform)


@router.delete("/fcm-token", status_code=204)
def remove_fcm_token(
    payload: FCMTokenRequest,
    service: Annotated[NotificationService, Depends(get_notification_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.remove_fcm_token(actor, token=payload.token)


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def update_preferences(
    payload: NotificationPreferenceRequest,
    service: Annotated[NotificationService, Depends(get_notification_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> NotificationPreferenceResponse:
    return service.update_preference(
        actor,
        job_alerts=payload.job_alerts,
        mission_reminders=payload.mission_reminders,
        career_tips=payload.career_tips,
        frequency=payload.frequency,
    )


@router.get("/preferences", response_model=NotificationPreferenceResponse | None)
def get_preferences(
    service: Annotated[NotificationService, Depends(get_notification_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> NotificationPreferenceResponse | None:
    return service.get_preference(actor)


@router.post("/send", status_code=202)
def send_notification(
    payload: SendNotificationRequest,
    service: Annotated[NotificationService, Depends(get_notification_service)],
) -> dict[str, str]:
    service.send_notification(
        user_id=payload.user_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
        image_url=payload.image_url,
    )
    return {"status": "queued"}


@router.get("", response_model=list[NotificationLogResponse])
def list_notifications(
    service: Annotated[NotificationService, Depends(get_notification_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[NotificationLogResponse]:
    return service.list_notifications(actor)


@router.patch("/{notification_id}/read", status_code=204)
def mark_notification_read(
    notification_id: str,
    service: Annotated[NotificationService, Depends(get_notification_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.mark_notification_read(actor, notification_id=notification_id)
