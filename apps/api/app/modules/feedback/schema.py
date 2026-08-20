"""Feedback endpoint schemas (typed public API contract)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

OutputType = Literal["assessment", "job_match", "coach_message", "roast", "rewrite"]
Rating = Literal["helpful", "not_helpful"]
FeedbackReason = Literal["incorrect", "too_generic", "not_relevant", "too_long", "other"]


class FeedbackRequest(BaseModel):
    output_type: OutputType
    output_id: str = Field(min_length=1, max_length=200)
    rating: Rating
    reason: FeedbackReason | None = None
    reason_detail: str | None = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    id: str
    output_type: str
    output_id: str
    rating: str
    reason: str | None = None
    created_at: str
    updated_at: str
