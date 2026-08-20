"""Interview coach endpoint schemas (typed public API contract)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

InterviewMode = Literal["hr", "technical", "behavioral", "manager", "startup", "custom"]


class InterviewSessionCreateRequest(BaseModel):
    mode: InterviewMode
    resume_id: str | None = None
    target_job: str | None = Field(default=None, max_length=200)
    target_skills: list[str] = Field(default_factory=list, max_length=50)


class InterviewQuestionResponse(BaseModel):
    id: str
    question: str
    focus: str


class InterviewSessionResponse(BaseModel):
    id: str
    mode: str
    target_job: str | None = None
    target_skills: list[str]
    status: str
    created_at: str


class InterviewSessionDetailResponse(BaseModel):
    session: InterviewSessionResponse
    questions: list[InterviewQuestionResponse]


class InterviewAnswerRequest(BaseModel):
    question_id: str
    content: str = Field(min_length=1, max_length=6000)


class InterviewEvaluationResponse(BaseModel):
    relevance: int
    clarity: int
    structure: int
    technical_correctness: int
    completeness: int
    feedback: str
    suggested_answer: str


class InterviewAnswerResponse(BaseModel):
    id: str
    question_id: str
    content: str
    evaluation: InterviewEvaluationResponse
    created_at: str
