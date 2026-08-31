"""Resume tailor use cases: tailor a resume for a specific job description.

AI output is always reviewable. Tailoring never overwrites the original
resume version; a new version is created when the user accepts the diff.
"""

from __future__ import annotations

import logging

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import ResumeContent
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client
from app.modules.job_match.repository import JobDescriptionRepository
from app.modules.resumes.repository import ResumeRepository

from .repository import ResumeTailorRepository
from .schema import TailorDiff, TailorResponse

logger = logging.getLogger(__name__)


class TailorAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The resume tailoring could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class TailorNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Tailor record not found.",
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
            message="This resume has no content to tailor yet. Import or edit it first.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class TailorAlreadyAcceptedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="already_accepted",
            message="This tailored version has already been accepted.",
            status_code=status.HTTP_409_CONFLICT,
        )


class ResumeTailorService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._resume_repository = ResumeRepository(service_client)
        self._job_description_repository = JobDescriptionRepository(service_client)
        self._repository = ResumeTailorRepository(service_client)

    def tailor_resume(
        self,
        actor: CurrentActor,
        *,
        resume_id: str,
        job_description_id: str,
        resume_version_id: str | None = None,
        locale: str = "en",
    ) -> TailorResponse:
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

        jd = self._job_description_repository.get(
            actor=actor, job_description_id=job_description_id
        )
        if jd is None:
            raise JobDescriptionNotFoundError()

        try:
            result = self._provider.tailor_resume(content, jd["raw_text"], locale=locale)
        except ProviderError as exc:
            raise TailorAiError() from exc

        tailored_content = result.content.tailored_content
        diffs = [
            TailorDiff(
                field=d.field,
                original=d.original,
                tailored=d.tailored,
                reasoning=d.reasoning,
            )
            for d in result.content.diffs
        ]

        record = self._repository.create(
            actor=actor,
            resume_id=resume_id,
            job_description_id=job_description_id,
            original_version_id=version_id,
            tailored_version_id=None,
            tailored_content=tailored_content.model_dump(),
            diffs=[d.model_dump() for d in diffs],
        )

        return _to_tailor_response(record)

    def accept_tailor(
        self,
        actor: CurrentActor,
        *,
        tailor_id: str,
    ) -> TailorResponse:
        record = self._repository.get(actor=actor, tailor_id=tailor_id)
        if record is None:
            raise TailorNotFoundError()

        if record.get("accepted"):
            raise TailorAlreadyAcceptedError()

        latest = self._resume_repository.get_latest_version(resume_id=record["resume_id"])
        next_version = (latest["version"] + 1) if latest else 1

        tailored_content = record["tailored_content"]
        new_version = self._resume_repository.create_version(
            resume_id=record["resume_id"],
            owner={"user_id": actor.id} if actor.kind == "user" else {"guest_id": actor.id},
            version=next_version,
            source="tailor",
            structured_data=tailored_content,
            source_request_id=record["id"],
        )

        self._resume_repository.set_current_version(
            resume_id=record["resume_id"],
            version_id=new_version["id"],
        )

        updated = self._repository.update_acceptance(
            actor=actor,
            tailor_id=tailor_id,
            tailored_version_id=new_version["id"],
        )
        if updated is None:
            raise TailorNotFoundError()

        return _to_tailor_response(updated)

    def get_tailor_history(
        self,
        actor: CurrentActor,
        *,
        resume_id: str,
    ) -> list[TailorResponse]:
        rows = self._repository.list_by_user(actor=actor, resume_id=resume_id)
        return [_to_tailor_response(row) for row in rows]

    def delete_tailor(
        self,
        actor: CurrentActor,
        *,
        tailor_id: str,
    ) -> None:
        record = self._repository.get(actor=actor, tailor_id=tailor_id)
        if record is None:
            raise TailorNotFoundError()
        self._repository.delete(actor=actor, tailor_id=tailor_id)


def _to_tailor_response(row: dict) -> TailorResponse:
    return TailorResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id", ""),
        resume_id=row["resume_id"],
        job_description_id=row["job_description_id"],
        tailored_content=ResumeContent.model_validate(row["tailored_content"]),
        diffs=[TailorDiff.model_validate(d) for d in (row.get("diffs") or [])],
        original_version_id=row["original_version_id"],
        tailored_version_id=row.get("tailored_version_id"),
        created_at=row["created_at"],
        accepted=row.get("accepted", False),
    )
