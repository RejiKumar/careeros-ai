"""Coach use cases: contextual, conversational career guidance.

User messages are persisted immediately; the assistant reply is written
server-side after provider validation. Provider output is advisory only and
never mutates the user's resume. Thread context may reference a resume whose
current version content is fed to the provider as read-only context.
"""

from __future__ import annotations

import json

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import CoachMessage, ResumeContent
from app.core.auth import CurrentUser
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client
from app.modules.resumes.repository import ResumeRepository
from fastapi import status

from .repository import CoachRepository
from .schema import (
    CoachMessagePairResponse,
    CoachMessageResponse,
    CoachThreadDetailResponse,
    CoachThreadResponse,
)


class CoachThreadNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Coach thread not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ResumeNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Resume not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class CoachAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The coach could not respond right now. Your message was saved; try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class CoachService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._resume_repository = ResumeRepository(service_client)
        self._repository = CoachRepository(service_client)

    def create_thread(
        self,
        user: CurrentUser,
        title: str | None,
        resume_id: str | None,
        job_description_id: str | None = None,
    ) -> CoachThreadResponse:
        context: dict[str, str] = {}
        if resume_id is not None:
            resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
            if resume is None:
                raise ResumeNotFoundError()
            context["resume_id"] = resume_id
        if job_description_id is not None:
            context["job_description_id"] = job_description_id
        thread = self._repository.create_thread(
            user_id=user.id, title=title, context=context or None
        )
        return _to_thread_response(thread)

    def update_thread(
        self,
        user: CurrentUser,
        thread_id: str,
        *,
        title: str | None = None,
        resume_id: str | None = None,
        job_description_id: str | None = None,
    ) -> CoachThreadResponse:
        thread = self._repository.get_thread(user_id=user.id, thread_id=thread_id)
        if thread is None:
            raise CoachThreadNotFoundError()

        existing_context = thread.get("context") or {}
        context: dict[str, str] = dict(existing_context)

        if resume_id is not None:
            resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
            if resume is None:
                raise ResumeNotFoundError()
            context["resume_id"] = resume_id
        elif resume_id is None and "resume_id" in context:
            del context["resume_id"]

        if job_description_id is not None:
            context["job_description_id"] = job_description_id
        elif job_description_id is None and "job_description_id" in context:
            del context["job_description_id"]

        updated = self._repository.update_thread(
            user_id=user.id,
            thread_id=thread_id,
            title=title,
            context=context or None,
        )
        return _to_thread_response(updated)

    def delete_thread(self, user: CurrentUser, thread_id: str) -> None:
        thread = self._repository.get_thread(user_id=user.id, thread_id=thread_id)
        if thread is None:
            raise CoachThreadNotFoundError()
        self._repository.delete_thread(user_id=user.id, thread_id=thread_id)

    def post_message(
        self, user: CurrentUser, thread_id: str, content: str, *, locale: str = "en"
    ) -> CoachMessagePairResponse:
        thread = self._repository.get_thread(user_id=user.id, thread_id=thread_id)
        if thread is None:
            raise CoachThreadNotFoundError()

        user_message = self._repository.create_message(
            user_id=user.id, thread_id=thread_id, role="user", content=content, request_id=None
        )
        history = [
            CoachMessage(role=row["role"], content=row["content"])
            for row in self._repository.list_messages(thread_id=thread_id)
        ]
        resume_context = self._build_context_str(user, thread.get("context"))

        try:
            result = self._provider.coach_reply(history, resume_context, locale=locale)
        except ProviderError as exc:
            raise CoachAiError() from exc

        assistant_message = self._repository.create_message(
            user_id=user.id,
            thread_id=thread_id,
            role="assistant",
            content=result.content.content,
            request_id=result.request_id,
        )
        return CoachMessagePairResponse(
            user_message=_to_message_response(user_message),
            assistant_message=_to_message_response(assistant_message),
        )

    def get_thread_detail(
        self, user: CurrentUser, thread_id: str, *, limit: int = 50, offset: int = 0
    ) -> CoachThreadDetailResponse:
        thread = self._repository.get_thread(user_id=user.id, thread_id=thread_id)
        if thread is None:
            raise CoachThreadNotFoundError()
        rows = self._repository.list_messages(thread_id=thread_id, limit=limit, offset=offset)
        messages = [_to_message_response(row) for row in rows]
        return CoachThreadDetailResponse(thread=_to_thread_response(thread), messages=messages)

    def list_threads(self, user: CurrentUser) -> list[CoachThreadResponse]:
        return [_to_thread_response(row) for row in self._repository.list_threads(user_id=user.id)]

    def _build_context_str(self, user: CurrentUser, context: dict | None) -> str | None:
        """Build a read-only context string from resume and/or job description references."""
        if not context:
            return None
        parts: list[str] = []
        resume_id = context.get("resume_id")
        if resume_id:
            resume = self._resume_repository.get_resume(actor=user, resume_id=resume_id)
            if resume:
                version_id = resume.get("current_version_id")
                if version_id:
                    version = self._resume_repository.get_version(
                        resume_id=resume_id, version_id=version_id
                    )
                    if version:
                        try:
                            content = ResumeContent.model_validate(version["structured_data"])
                            parts.append(
                                json.dumps(content.model_dump(mode="json"), ensure_ascii=False)
                            )
                        except ValueError:
                            pass
        return "\n\n".join(parts) if parts else None


def _to_thread_response(row: dict) -> CoachThreadResponse:
    context = row.get("context") or {}
    return CoachThreadResponse(
        id=row["id"],
        title=row.get("title"),
        resume_id=context.get("resume_id"),
        job_description_id=context.get("job_description_id"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_message_response(row: dict) -> CoachMessageResponse:
    return CoachMessageResponse(
        id=row["id"],
        thread_id=row["thread_id"],
        role=row["role"],
        content=row["content"],
        created_at=row["created_at"],
    )

