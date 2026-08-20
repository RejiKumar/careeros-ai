"""Billing endpoint schemas."""
from __future__ import annotations

from pydantic import BaseModel


class EntitlementResponse(BaseModel):
    plan: str
    status: str
    usage: dict[str, int]
    limits: dict[str, int | None]


class UsageEventRequest(BaseModel):
    feature: str
    event_key: str
    quantity: int = 1


class UsageEventResponse(BaseModel):
    recorded: bool
    current_usage: int
    limit: int | None
