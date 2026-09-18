"""Push notification and preference endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class FCMTokenRequest(BaseModel):
    token: str
    platform: str = "android"


class FCMTokenResponse(BaseModel):
    id: str
    user_id: str
    token: str
    platform: str
    created_at: str
    updated_at: str


class NotificationPreferenceResponse(BaseModel):
    id: str
    user_id: str
    job_alerts: bool
    mission_reminders: bool
    career_tips: bool
    frequency: str
    created_at: str
    updated_at: str


class NotificationPreferenceRequest(BaseModel):
    job_alerts: bool | None = None
    mission_reminders: bool | None = None
    career_tips: bool | None = None
    frequency: str | None = None


class NotificationLogResponse(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    type: str
    sent_at: str
    read_at: str | None
