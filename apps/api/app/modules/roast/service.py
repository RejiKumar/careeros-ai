"""Roast use case: constructive, mode-constrained resume critique."""

from __future__ import annotations

import logging

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import ResumeContent
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)
from fastapi import status

from .repository import RoastRepository
from .schema import RoastCreateRequest, RoastResponse, RoastSectionResponse

logger = logging.getLogger(__name__)


class ResumeNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Resume not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class NoParsedContentError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="no_parsed_content",
            message="This resume has no parsed content to roast yet.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class RoastProviderError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The roast could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class RoastService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        self._clients = clients
        self._provider = provider
        self._repository = RoastRepository(require_service_client(clients))

    def create_roast(self, actor: CurrentActor, payload: RoastCreateRequest) -> RoastResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)

        resume = self._repository.get_parsed_resume(
            resume_id=payload.resume_id, actor_id=actor.id, is_guest=actor.kind == "guest"
        )
        if resume is None:
            raise ResumeNotFoundError()
        structured = resume.get("structured_data")
        if not structured:
            raise NoParsedContentError()

        try:
            content = ResumeContent.model_validate(structured)
        except Exception:
            raise NoParsedContentError() from None

        try:
            result = self._provider.roast_resume(content, mode=payload.mode)
        except ProviderError as exc:
            logger.warning("Roast provider failure (resume %s)", payload.resume_id)
            raise RoastProviderError() from exc

        row = self._repository.create_roast(
            resume_id=payload.resume_id,
            mode=payload.mode,
            actor_id=actor.id,
            is_guest=actor.kind == "guest",
            request_id=result.request_id,
            model_version=result.model_version,
            content=result.content.model_dump(mode="json"),
        )

        return RoastResponse(
            id=row["id"],
            resume_id=row["resume_id"],
            mode=row["mode"],
            tone=result.content.tone,
            sections=[
                RoastSectionResponse(title=section.title, content=section.content)
                for section in result.content.sections
            ],
            improvements=result.content.improvements,
            model_version=row.get("model_version"),
            created_at=row["created_at"],
        )
