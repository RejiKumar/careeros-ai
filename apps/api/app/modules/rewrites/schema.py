"""Rewrite suggestion endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel

from app.ai.schemas import ResumeContent, RewriteSuggestion


class RewriteBatchResponse(BaseModel):
    id: str
    resume_id: str
    status: str
    suggestions: list[RewriteSuggestion]
    resume_version_id: str
    source_version_number: int
    accepted_version_id: str | None
    model_version: str | None
    created_at: str


class RewriteAcceptRequest(BaseModel):
    """The full resume content the user explicitly accepted after reviewing.

    This is the reviewed, user-approved revision; the server snapshots it into
    a new immutable version.
    """

    accepted_data: ResumeContent


class RewriteAcceptedResponse(BaseModel):
    resume_id: str
    version: int
    version_id: str
    status: str
