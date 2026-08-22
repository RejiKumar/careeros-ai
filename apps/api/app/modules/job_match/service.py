"""Job match use cases: paste a job description and match it to a resume.

The job description is untrusted user text; it is delimited when sent to the
provider and never treated as ground truth. Matches are immutable and pinned
to a resume version snapshot.
"""

from __future__ import annotations

import re

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import MatchAction, ResumeContent
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client
from app.modules.resumes.repository import ResumeRepository

from .repository import JobDescriptionRepository
from .schema import (
    JobDescriptionMatchResponse,
    JobDescriptionResponse,
    MatchResponse,
)


class MatchAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The job match could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class JobDescriptionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Job description not found.",
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
            message="This resume has no content to match yet. Import or edit it first.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class JobMatchService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._resume_repository = ResumeRepository(service_client)
        self._repository = JobDescriptionRepository(service_client)

    def create_with_match(
        self,
        actor: CurrentActor,
        *,
        title: str | None,
        company: str | None,
        raw_text: str,
        resume_id: str,
        resume_version_id: str | None = None,
        locale: str = "en",
    ) -> JobDescriptionMatchResponse:
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
        jd = self._repository.create(
            actor=actor,
            title=title,
            company=company,
            raw_text=raw_text,
            normalized_text=_normalize(raw_text),
            resume_id=resume_id,
        )

        try:
            result = self._provider.match_resume(content, raw_text, locale=locale)
        except ProviderError as exc:
            self._repository.delete(actor=actor, job_description_id=jd["id"])
            raise MatchAiError() from exc

        match = self._repository.create_match(
            actor=actor,
            job_description_id=jd["id"],
            resume_version_id=version_id,
            request_id=result.request_id,
            model_version=result.model_version,
            score=result.content.score,
            matched_skills=result.content.matched_skills,
            missing_skills=result.content.missing_skills,
            strengths=result.content.strengths,
            actions=[action.model_dump() for action in result.content.actions],
        )
        return JobDescriptionMatchResponse(
            job_description=_to_jd_response(jd),
            match=_to_match_response(match),
        )

    def get_job_description(
        self, actor: CurrentActor, job_description_id: str
    ) -> JobDescriptionResponse:
        jd = self._repository.get(actor=actor, job_description_id=job_description_id)
        if jd is None:
            raise JobDescriptionNotFoundError()
        return _to_jd_response(jd)

    def list_matches(self, actor: CurrentActor, job_description_id: str) -> list[MatchResponse]:
        jd = self._repository.get(actor=actor, job_description_id=job_description_id)
        if jd is None:
            raise JobDescriptionNotFoundError()
        rows = self._repository.list_matches(actor=actor, job_description_id=job_description_id)
        return [_to_match_response(row) for row in rows]

    def list_job_descriptions(self, actor: CurrentActor) -> list[JobDescriptionResponse]:
        rows = self._repository.list(actor=actor)
        return [_to_jd_response(row) for row in rows]

    def update_job_description(
        self,
        actor: CurrentActor,
        job_description_id: str,
        *,
        title: str | None = None,
        company: str | None = None,
        raw_text: str | None = None,
    ) -> JobDescriptionResponse:
        existing = self._repository.get(actor=actor, job_description_id=job_description_id)
        if existing is None:
            raise JobDescriptionNotFoundError()

        normalized_text = _normalize(raw_text) if raw_text else None
        updated = self._repository.update(
            actor=actor,
            job_description_id=job_description_id,
            title=title,
            company=company,
            raw_text=raw_text,
            normalized_text=normalized_text,
        )
        if updated is None:
            raise JobDescriptionNotFoundError()
        return _to_jd_response(updated)

    def delete_job_description(self, actor: CurrentActor, job_description_id: str) -> None:
        existing = self._repository.get(actor=actor, job_description_id=job_description_id)
        if existing is None:
            raise JobDescriptionNotFoundError()
        self._repository.delete(actor=actor, job_description_id=job_description_id)

    def run_match(
        self,
        actor: CurrentActor,
        job_description_id: str,
        *,
        resume_id: str,
        resume_version_id: str | None = None,
        locale: str = "en",
    ) -> MatchResponse:
        jd = self._repository.get(actor=actor, job_description_id=job_description_id)
        if jd is None:
            raise JobDescriptionNotFoundError()

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
        raw_text = jd["raw_text"]

        try:
            result = self._provider.match_resume(content, raw_text, locale=locale)
        except ProviderError as exc:
            raise MatchAiError() from exc

        match = self._repository.create_match(
            actor=actor,
            job_description_id=job_description_id,
            resume_version_id=version_id,
            request_id=result.request_id,
            model_version=result.model_version,
            score=result.content.score,
            matched_skills=result.content.matched_skills,
            missing_skills=result.content.missing_skills,
            strengths=result.content.strengths,
            actions=[action.model_dump() for action in result.content.actions],
        )
        return _to_match_response(match)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _to_jd_response(row: dict) -> JobDescriptionResponse:
    return JobDescriptionResponse(
        id=row["id"],
        title=row.get("title"),
        company=row.get("company"),
        raw_text=row["raw_text"],
        resume_id=row.get("resume_id"),
        created_at=row["created_at"],
        updated_at=row.get("updated_at"),
    )


def _to_match_response(row: dict) -> MatchResponse:
    return MatchResponse(
        id=row["id"],
        job_description_id=row["job_description_id"],
        resume_version_id=row["resume_version_id"],
        score=row["score"],
        matched_skills=list(row.get("matched_skills") or []),
        missing_skills=list(row.get("missing_skills") or []),
        strengths=list(row.get("strengths") or []),
        actions=[MatchAction.model_validate(action) for action in (row.get("actions") or [])],
        model_version=row.get("model_version"),
        created_at=row["created_at"],
    )
