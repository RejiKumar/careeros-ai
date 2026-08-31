"""Skills Gap Radar use cases: compare a resume against a job description
and surface matched, partial, and missing skills with learning resources.
"""

from __future__ import annotations

import logging

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import ResumeContent
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client
from app.modules.resumes.repository import ResumeRepository

from .repository import SkillsGapRepository
from .schema import (
    GapAnalysisHistoryResponse,
    GapAnalysisResponse,
    LearningResource,
    SkillGap,
)

logger = logging.getLogger(__name__)


class GapAnalysisAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The skills gap analysis could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class AnalysisNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Skills gap analysis not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ResumeNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Resume not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class JobDescriptionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Job description not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class NoResumeContentError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="no_resume_content",
            message="This resume has no content yet. Import or edit it first.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class SkillsGapService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._resume_repository = ResumeRepository(service_client)
        self._repository = SkillsGapRepository(service_client)
        self._jd_client = service_client

    def analyze_gap(
        self,
        actor: CurrentActor,
        *,
        resume_id: str,
        job_description_id: str,
        resume_version_id: str | None = None,
    ) -> GapAnalysisResponse:
        resume = self._resume_repository.get_resume(actor=actor, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        version_id = resume_version_id or resume.get("current_version_id")
        if not version_id:
            raise NoResumeContentError()

        version = self._resume_repository.get_version(resume_id=resume_id, version_id=version_id)
        if version is None:
            raise NoResumeContentError()

        content = ResumeContent.model_validate(version["structured_data"])

        jd_rows = (
            self._jd_client.table("job_descriptions")
            .select("raw_text")
            .eq("id", job_description_id)
            .execute()
            .data
        )
        if not jd_rows:
            raise JobDescriptionNotFoundError()
        job_description_text = jd_rows[0]["raw_text"]

        try:
            result = self._provider.analyze_skills_gap(content, job_description_text)
        except ProviderError as exc:
            raise GapAnalysisAiError() from exc

        matched_skills = [_to_skill_gap(s, "matched") for s in result.content.matched_skills]
        partial_skills = [_to_skill_gap(s, "partial") for s in result.content.partial_skills]
        missing_skills = [_to_skill_gap(s, "missing") for s in result.content.missing_skills]

        total_skills = len(matched_skills) + len(partial_skills) + len(missing_skills)
        overall_match = round(len(matched_skills) / total_skills, 2) if total_skills > 0 else 0.0

        row = self._repository.create(
            actor=actor,
            resume_id=resume_id,
            job_description_id=job_description_id,
            matched_skills=[s.model_dump() for s in matched_skills],
            partial_skills=[s.model_dump() for s in partial_skills],
            missing_skills=[s.model_dump() for s in missing_skills],
            overall_match=overall_match,
        )

        return _to_gap_response(row)

    def get_analysis(self, actor: CurrentActor, *, analysis_id: str) -> GapAnalysisResponse:
        row = self._repository.get(actor=actor, analysis_id=analysis_id)
        if row is None:
            raise AnalysisNotFoundError()
        return _to_gap_response(row)

    def list_analyses(self, actor: CurrentActor) -> GapAnalysisHistoryResponse:
        rows = self._repository.list_by_user(actor=actor)
        analyses = [_to_gap_response(row) for row in rows]
        return GapAnalysisHistoryResponse(analyses=analyses, total=len(analyses))

    def delete_analysis(self, actor: CurrentActor, *, analysis_id: str) -> None:
        existing = self._repository.get(actor=actor, analysis_id=analysis_id)
        if existing is None:
            raise AnalysisNotFoundError()
        self._repository.delete(actor=actor, analysis_id=analysis_id)


def _to_skill_gap(item: object, fallback_status: str) -> SkillGap:
    data = item.model_dump() if hasattr(item, "model_dump") else item  # type: ignore[arg-type]
    resources = None
    raw_resources = data.get("learning_resources") if isinstance(data, dict) else None
    if raw_resources:
        resources = [
            LearningResource(
                title=r.get("title", ""),
                url=r.get("url"),
                type=r.get("type", "course"),
                provider=r.get("provider"),
            )
            for r in raw_resources
        ]
    return SkillGap(
        skill=data.get("skill", "") if isinstance(data, dict) else "",
        status=data.get("status", fallback_status) if isinstance(data, dict) else fallback_status,
        resume_evidence=data.get("resume_evidence") if isinstance(data, dict) else None,
        job_requirement=data.get("job_requirement", "") if isinstance(data, dict) else "",
        confidence=float(data.get("confidence", 0.0)) if isinstance(data, dict) else 0.0,
        learning_resources=resources,
    )


def _to_gap_response(row: dict) -> GapAnalysisResponse:
    return GapAnalysisResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id", ""),
        resume_id=row["resume_id"],
        job_description_id=row["job_description_id"],
        matched_skills=[SkillGap.model_validate(s) for s in (row.get("matched_skills") or [])],
        partial_skills=[SkillGap.model_validate(s) for s in (row.get("partial_skills") or [])],
        missing_skills=[SkillGap.model_validate(s) for s in (row.get("missing_skills") or [])],
        overall_match=float(row.get("overall_match", 0.0)),
        created_at=row["created_at"],
    )
