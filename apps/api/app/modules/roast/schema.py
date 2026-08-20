"""Roast endpoint schemas (typed public API contract)."""

from __future__ import annotations

from app.ai.schemas import RoastMode
from pydantic import BaseModel


class RoastCreateRequest(BaseModel):
    resume_id: str
    mode: RoastMode


class RoastSectionResponse(BaseModel):
    title: str
    content: str


class RoastResponse(BaseModel):
    id: str
    resume_id: str
    mode: str
    tone: str
    sections: list[RoastSectionResponse]
    improvements: list[str]
    model_version: str | None = None
    created_at: str
