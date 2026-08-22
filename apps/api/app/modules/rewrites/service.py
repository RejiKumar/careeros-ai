"""Rewrite use cases: generate reviewable suggestions and accept reviewed ones.

AI output is never applied directly: the user reviews (and may edit) the
suggestions, then explicitly accepts the final content. Acceptance always
creates a new immutable resume version snapshot.
"""

from __future__ import annotations

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import ResumeContent, RewriteSuggestion
from app.core.auth import CurrentUser
from app.core.errors import AppError
from app.core.owner import owner_fields
from app.integrations.supabase.client import SupabaseClients, require_service_client
from app.modules.resumes.repository import ResumeRepository

from .repository import RewriteRepository
from .schema import RewriteAcceptedResponse, RewriteBatchResponse

STATUS_PENDING = "pending"
STATUS_ACCEPTED = "accepted"


class RewriteAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="Rewrites could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class RewriteNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Rewrite batch not found.",
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
            message="This resume has no content to rewrite yet. Import or edit it first.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class RewriteAlreadyAcceptedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="rewrite_already_accepted",
            message="This rewrite batch was already accepted.",
            status_code=status.HTTP_409_CONFLICT,
        )


class RewriteStaleVersionError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="rewrite_stale_version",
            message="The resume has changed since this rewrite was generated. "
            "Please generate fresh suggestions.",
            status_code=status.HTTP_409_CONFLICT,
        )


class RewriteService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._resume_repository = ResumeRepository(service_client)
        self._repository = RewriteRepository(service_client)

    def create_batch(
        self, user: CurrentUser, resume_id: str, *, locale: str = "en"
    ) -> RewriteBatchResponse:
        resume, version_id, version_number, content = self._load_current_content(user, resume_id)

        try:
            result = self._provider.suggest_rewrites(content, locale=locale)
        except ProviderError as exc:
            raise RewriteAiError() from exc

        batch = self._repository.create(
            user_id=user.id,
            resume_version_id=version_id,
            source_version_number=version_number,
            status=STATUS_PENDING,
            suggestions=[suggestion.model_dump() for suggestion in result.content.suggestions],
            request_id=result.request_id,
            model_version=result.model_version,
        )
        return _to_batch_response(batch, resume_id=resume_id)

    def accept_batch(
        self,
        user: CurrentUser,
        resume_id: str,
        rewrite_id: str,
        accepted_data: ResumeContent,
    ) -> RewriteAcceptedResponse:
        resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        batch = self._repository.get(user_id=user.id, rewrite_id=rewrite_id)
        if batch is None:
            raise RewriteNotFoundError()
        if batch["status"] == STATUS_ACCEPTED:
            raise RewriteAlreadyAcceptedError()

        current_version_id = resume.get("current_version_id")
        batch_version_id = batch.get("resume_version_id")
        if current_version_id and batch_version_id and current_version_id != batch_version_id:
            raise RewriteStaleVersionError()

        latest = self._resume_repository.get_latest_version(resume_id=resume_id)
        next_version = latest["version"] + 1 if latest else 1
        version = self._resume_repository.create_version(
            resume_id=resume_id,
            owner=owner_fields(user),
            version=next_version,
            source="ai_suggestion",
            structured_data=accepted_data.model_dump(mode="json"),
            source_request_id=batch.get("request_id"),
        )
        self._resume_repository.set_current_version(resume_id=resume_id, version_id=version["id"])
        self._repository.mark_accepted(rewrite_id=rewrite_id, version_id=version["id"])

        return RewriteAcceptedResponse(
            resume_id=resume_id,
            version=next_version,
            version_id=version["id"],
            status=STATUS_ACCEPTED,
        )

    def get_batch(self, user: CurrentUser, resume_id: str, rewrite_id: str) -> RewriteBatchResponse:
        resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        batch = self._repository.get(user_id=user.id, rewrite_id=rewrite_id)
        if batch is None:
            raise RewriteNotFoundError()
        return _to_batch_response(batch, resume_id=resume_id)

    def list_batches(self, user: CurrentUser, resume_id: str) -> list[RewriteBatchResponse]:
        resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        version_ids = [
            row["id"] for row in self._resume_repository.list_versions(resume_id=resume_id)
        ]
        rows = self._repository.list_for_resume_versions(
            user_id=user.id, resume_version_ids=version_ids
        )
        rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
        return [_to_batch_response(row, resume_id=resume_id) for row in rows]

    def _load_current_content(
        self, user: CurrentUser, resume_id: str
    ) -> tuple[dict, str, int, ResumeContent]:
        resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        version_id = resume.get("current_version_id")
        if not version_id:
            raise NoResumeContentError()

        version = self._resume_repository.get_version(resume_id=resume_id, version_id=version_id)
        if version is None:
            raise NoResumeContentError()

        content = ResumeContent.model_validate(version["structured_data"])
        return resume, version_id, version["version"], content


def _to_batch_response(row: dict, *, resume_id: str) -> RewriteBatchResponse:
    return RewriteBatchResponse(
        id=row["id"],
        resume_id=resume_id,
        status=row["status"],
        suggestions=[RewriteSuggestion.model_validate(s) for s in (row.get("suggestions") or [])],
        resume_version_id=row["resume_version_id"],
        source_version_number=row.get("source_version_number", 1),
        accepted_version_id=row.get("accepted_version_id"),
        model_version=row.get("model_version"),
        created_at=row["created_at"],
    )
