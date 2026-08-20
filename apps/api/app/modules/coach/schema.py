"""Coach endpoint schemas (typed public API contract)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CoachThreadCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    resume_id: str | None = None
    job_description_id: str | None = None


class CoachThreadUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    resume_id: str | None = None
    job_description_id: str | None = None


class CoachThreadResponse(BaseModel):
    id: str
    title: str | None
    resume_id: str | None
    job_description_id: str | None = None
    created_at: str
    updated_at: str


class CoachMessageResponse(BaseModel):
    id: str
    thread_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str


class CoachThreadDetailResponse(BaseModel):
    thread: CoachThreadResponse
    messages: list[CoachMessageResponse]


class CoachMessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=4000)


class CoachMessagePairResponse(BaseModel):
    user_message: CoachMessageResponse
    assistant_message: CoachMessageResponse
