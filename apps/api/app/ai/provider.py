"""Provider-neutral AI interface.

Domain and use-case code depends only on ``CareerAiProvider`` and the shared
schemas in ``app.ai.schemas``. Provider SDKs are isolated in sibling modules
so a future OpenAI adapter can implement the same protocol without touching
domain code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Annotated

from fastapi import Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings

from .schemas import (
    AnswerEvaluation,
    CoachMessage,
    CoachReply,
    GapAnalysisContent,
    InterviewQuestionsContent,
    JobMatchContent,
    ResumeAssessment,
    ResumeContent,
    RewriteContent,
    RoastContent,
    RoastMode,
    TailorContent,
)


class ProviderError(Exception):
    """A provider call failed or returned output that failed validation."""


class ParsedResume(BaseModel):
    content: ResumeContent
    request_id: str
    model_version: str


class AssessmentResult(BaseModel):
    content: ResumeAssessment
    request_id: str
    model_version: str


class MatchResult(BaseModel):
    content: JobMatchContent
    request_id: str
    model_version: str


class RewriteResult(BaseModel):
    content: RewriteContent
    request_id: str
    model_version: str


class CoachResult(BaseModel):
    content: CoachReply
    request_id: str
    model_version: str


class RoastResult(BaseModel):
    content: RoastContent
    request_id: str
    model_version: str


class InterviewQuestionsResult(BaseModel):
    content: InterviewQuestionsContent
    request_id: str
    model_version: str


class AnswerEvaluationResult(BaseModel):
    content: AnswerEvaluation
    request_id: str
    model_version: str


class TailorResult(BaseModel):
    content: TailorContent
    request_id: str
    model_version: str


class GapAnalysisResult(BaseModel):
    content: GapAnalysisContent
    request_id: str
    model_version: str


class CareerAiProvider(ABC):
    """Provider-neutral AI capabilities used by feature use cases."""

    @abstractmethod
    def parse_resume(self, text: str) -> ParsedResume:
        """Extract structured resume content from untrusted resume text."""
        raise NotImplementedError

    @abstractmethod
    def assess_resume(self, content: ResumeContent, *, locale: str = "en") -> AssessmentResult:
        """Assess structured resume content; free-text output follows ``locale``."""
        raise NotImplementedError

    @abstractmethod
    def match_resume(
        self, content: ResumeContent, job_description: str, *, locale: str = "en"
    ) -> MatchResult:
        """Score how well a structured resume matches a pasted job description."""
        raise NotImplementedError

    @abstractmethod
    def suggest_rewrites(self, content: ResumeContent, *, locale: str = "en") -> RewriteResult:
        """Propose reviewable rewrites that never add new facts."""
        raise NotImplementedError

    @abstractmethod
    def coach_reply(
        self,
        messages: list[CoachMessage],
        resume_context: str | None,
        *,
        locale: str = "en",
    ) -> CoachResult:
        """Reply to a career coaching question with optional resume context."""
        raise NotImplementedError

    @abstractmethod
    def roast_resume(
        self, content: ResumeContent, mode: RoastMode, *, locale: str = "en"
    ) -> RoastResult:
        """Produce a constructive, mode-constrained roast ending in improvements."""
        raise NotImplementedError

    @abstractmethod
    def generate_interview_questions(
        self,
        content: ResumeContent | None,
        mode: str,
        target_job: str | None,
        target_skills: list[str],
        *,
        locale: str = "en",
    ) -> InterviewQuestionsResult:
        """Generate a session's interview questions from resume/job context."""
        raise NotImplementedError

    @abstractmethod
    def evaluate_interview_answer(
        self,
        question: str,
        answer: str,
        resume_context: str | None,
        *,
        locale: str = "en",
    ) -> AnswerEvaluationResult:
        """Evaluate one interview answer as guidance, not a hiring judgment."""
        raise NotImplementedError

    @abstractmethod
    def analyze_skills_gap(
        self,
        resume_content: ResumeContent,
        job_description: str,
        *,
        locale: str = "en",
    ) -> GapAnalysisResult:
        """Analyze the skills gap between structured resume content and a job description."""
        raise NotImplementedError

    @abstractmethod
    def tailor_resume(
        self,
        content: ResumeContent,
        job_description: str,
        *,
        locale: str = "en",
    ) -> TailorResult:
        """Tailor a resume for a specific job description.

        Never fabricates experience, skills or qualifications.
        Only rephrases, reorders and emphasizes existing content.
        """
        raise NotImplementedError


def build_provider(settings: Settings) -> CareerAiProvider:
    """Resolve the configured AI provider. Raises ValueError when unconfigured."""
    if settings.gemini_api_key:
        from .gemini import GeminiProvider

        return GeminiProvider(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model or "gemini-3.6-flash",
        )
    raise ValueError("No AI provider configured: set CAREEROS_GEMINI_API_KEY")


def get_ai_provider(settings: Annotated[Settings, Depends(get_settings)]) -> CareerAiProvider:
    return build_provider(settings)
