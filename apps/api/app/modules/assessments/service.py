"""Resume health assessment use cases: run and read an assessment.

Assessments are immutable and always run against a resume version snapshot so
results are reproducible and never silently out of sync with the resume.
"""

from __future__ import annotations

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import GapFinding, HealthDimensionScore, ResumeContent
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.core.owner import owner_fields
from app.integrations.supabase.client import SupabaseClients, require_service_client
from app.modules.missions.service import MissionService
from app.modules.resumes.repository import ResumeRepository

from .repository import AssessmentRepository
from .schema import AssessmentResponse

PROMPT_VERSION = "resume-health-v1"


class AssessmentAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The resume could not be assessed right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class AssessmentNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Assessment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ResumeNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Resume not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class NoResumeContentError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="no_resume_content",
            message="This resume has no content to assess yet. Import or edit it first.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class AssessmentService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._clients = clients
        self._provider = provider
        self._resume_repository = ResumeRepository(service_client)
        self._repository = AssessmentRepository(service_client)

    def create_assessment(
        self, actor: CurrentActor, resume_id: str, *, locale: str = "en"
    ) -> AssessmentResponse:
        resume = self._resume_repository.get_resume(actor=actor, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        version_id = resume.get("current_version_id")
        if not version_id:
            raise NoResumeContentError()

        version = self._resume_repository.get_version(resume_id=resume_id, version_id=version_id)
        if version is None:
            raise NoResumeContentError()

        content = ResumeContent.model_validate(version["structured_data"])
        try:
            result = self._provider.assess_resume(content, locale=locale)
        except ProviderError as exc:
            raise AssessmentAiError() from exc

        row = self._repository.create(
            owner=owner_fields(actor),
            resume_version_id=version_id,
            request_id=result.request_id,
            model_version=result.model_version,
            prompt_version=PROMPT_VERSION,
            status="completed",
            scores=[score.model_dump() for score in result.content.scores],
            strengths=result.content.strengths,
            evidence=result.content.evidence,
            gaps=[gap.model_dump() for gap in result.content.gaps],
        )
        if actor.kind == "user":
            MissionService(self._clients).evaluate_achievements(actor)
        return _to_response(row, resume_id=resume_id)

    def get_assessment(self, actor: CurrentActor, assessment_id: str) -> AssessmentResponse:
        row = self._repository.get(actor=actor, assessment_id=assessment_id)
        if row is None:
            raise AssessmentNotFoundError()

        resume_id: str | None = None
        version = self._resume_repository.get_version_by_id(
            version_id=row["resume_version_id"], actor=actor
        )
        if version is not None:
            resume_id = version["resume_id"]
        return _to_response(row, resume_id=resume_id)


def _to_response(row: dict, *, resume_id: str | None) -> AssessmentResponse:
    return AssessmentResponse(
        id=row["id"],
        resume_id=resume_id,
        resume_version_id=row["resume_version_id"],
        status=row["status"],
        scores=[HealthDimensionScore.model_validate(s) for s in (row.get("scores") or [])],
        strengths=list(row.get("strengths") or []),
        gaps=[GapFinding.model_validate(g) for g in (row.get("gaps") or [])],
        evidence=list(row.get("evidence") or []),
        model_version=row.get("model_version"),
        prompt_version=row.get("prompt_version"),
        created_at=row["created_at"],
    )
