"""Wrapped endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel


class WrappedDataPoint(BaseModel):
    key: str
    label: str
    value: str
    available: bool


class WrappedAchievement(BaseModel):
    key: str
    title: str
    earned_at: str | None = None


class WrappedResponse(BaseModel):
    generated_at: str
    data_points: list[WrappedDataPoint]
    achievements: list[WrappedAchievement]
