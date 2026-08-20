"""Interview coach use cases: session, question generation, answer evaluation."""

from __future__ import annotations

import json
import logging

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import ResumeContent
from app.core.auth import CurrentActor, CurrentUser
from app.core.errors import AppError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)
from app.modules.missions.service import MissionService
from fastapi import status

from .repository import InterviewRepository
from .schema import (
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewEvaluationResponse,
    InterviewQuestionResponse,
    InterviewSessionCreateRequest,
    InterviewSessionDetailResponse,
    InterviewSessionResponse,
)

logger = logging.getLogger(__name__)


class SessionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Interview session not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class QuestionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Interview question not found in this session.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class InterviewProviderError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The interview could not be prepared right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class InterviewService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        self._clients = clients
        self._provider = provider
        self._repository = InterviewRepository(require_service_client(clients))

    def create_session(
        self, actor: CurrentActor, payload: InterviewSessionCreateRequest
    ) -> InterviewSessionDetailResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)

        resume_content: ResumeContent | None = None
        if payload.resume_id is not None:
            structured = self._repository.get_parsed_resume(
                resume_id=payload.resume_id, actor_id=actor.id, is_guest=actor.kind == "guest"
            )
            if structured is None:
                raise SessionNotFoundError()
            try:
                resume_content = ResumeContent.model_validate(structured)
            except Exception:
                resume_content = None

        try:
            result = self._provider.generate_interview_questions(
                resume_content,
                mode=payload.mode,
                target_job=payload.target_job,
                target_skills=payload.target_skills,
            )
        except ProviderError as exc:
            logger.warning(
                "Interview question generation failed (mode %s): %s",
                payload.mode,
                exc,
            )
            raise InterviewProviderError() from exc

        session_row = self._repository.create_session(
            mode=payload.mode,
            actor_id=actor.id,
            is_guest=actor.kind == "guest",
            resume_id=payload.resume_id,
            target_job=payload.target_job,
            target_skills=payload.target_skills,
            request_id=result.request_id,
            model_version=result.model_version,
        )
        questions = self._repository.create_questions(
            session_id=session_row["id"],
            questions=[
                {"question": q.question, "focus": q.focus}
                for q in result.content.questions
            ],
        )
        return InterviewSessionDetailResponse(
            session=_to_session_response(session_row),
            questions=[_to_question_response(q) for q in questions],
        )

    def list_sessions(self, actor: CurrentActor) -> list[InterviewSessionResponse]:
        rows = self._repository.list_sessions(
            actor_id=actor.id, is_guest=actor.kind == "guest"
        )
        return [_to_session_response(row) for row in rows]

    def get_session(self, actor: CurrentActor, session_id: str) -> InterviewSessionDetailResponse:
        session = self._repository.get_session(
            session_id=session_id, actor_id=actor.id, is_guest=actor.kind == "guest"
        )
        if session is None:
            raise SessionNotFoundError()
        questions = self._repository.list_questions(session_id=session_id)
        return InterviewSessionDetailResponse(
            session=_to_session_response(session),
            questions=[_to_question_response(q) for q in questions],
        )

    def submit_answer(
        self, actor: CurrentActor, session_id: str, payload: InterviewAnswerRequest
    ) -> InterviewAnswerResponse:
        session = self._repository.get_session(
            session_id=session_id, actor_id=actor.id, is_guest=actor.kind == "guest"
        )
        if session is None:
            raise SessionNotFoundError()
        question = self._repository.get_question(
            question_id=payload.question_id, session_id=session_id
        )
        if question is None:
            raise QuestionNotFoundError()

        resume_context = self._repository.get_parsed_resume(
            resume_id=session.get("resume_id"),
            actor_id=actor.id,
            is_guest=actor.kind == "guest",
        ) if session.get("resume_id") else None
        resume_text = (
            json.dumps(resume_context, ensure_ascii=False)[:10_000]
            if resume_context
            else None
        )

        try:
            result = self._provider.evaluate_interview_answer(
                question["question"], payload.content, resume_text
            )
        except ProviderError as exc:
            logger.warning("Interview answer evaluation failed (session %s)", session_id)
            raise InterviewProviderError() from exc

        answer = self._repository.create_answer(
            question_id=payload.question_id,
            content=payload.content,
            evaluation=result.content.model_dump(mode="json"),
            request_id=result.request_id,
            model_version=result.model_version,
        )
        if actor.kind == "user":
            MissionService(self._clients).evaluate_achievements(
                CurrentUser(id=actor.id, email=actor.email, role=actor.role)
            )
        return InterviewAnswerResponse(
            id=answer["id"],
            question_id=answer["question_id"],
            content=answer["content"],
            evaluation=InterviewEvaluationResponse(
                **answer["evaluation"]
            ),
            created_at=answer["created_at"],
        )


def _to_session_response(row: dict) -> InterviewSessionResponse:
    return InterviewSessionResponse(
        id=row["id"],
        mode=row["mode"],
        target_job=row.get("target_job"),
        target_skills=row.get("target_skills") or [],
        status=row.get("status", "active"),
        created_at=row["created_at"],
    )


def _to_question_response(row: dict) -> InterviewQuestionResponse:
    return InterviewQuestionResponse(
        id=row["id"],
        question=row["question"],
        focus=row.get("focus", ""),
    )
