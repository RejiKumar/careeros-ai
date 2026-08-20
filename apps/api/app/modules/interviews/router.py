"""Interview router: thin HTTP layer over the interview service."""

from __future__ import annotations

from typing import Annotated

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from fastapi import APIRouter, Depends

from .schema import (
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewSessionCreateRequest,
    InterviewSessionDetailResponse,
    InterviewSessionResponse,
)
from .service import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])


def get_interview_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> InterviewService:
    return InterviewService(clients, provider)


@router.post("/sessions", response_model=InterviewSessionDetailResponse, status_code=201)
def create_session(
    payload: InterviewSessionCreateRequest,
    service: Annotated[InterviewService, Depends(get_interview_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> InterviewSessionDetailResponse:
    return service.create_session(actor, payload)


@router.get("/sessions", response_model=list[InterviewSessionResponse])
def list_sessions(
    service: Annotated[InterviewService, Depends(get_interview_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[InterviewSessionResponse]:
    return service.list_sessions(actor)


@router.get("/sessions/{session_id}", response_model=InterviewSessionDetailResponse)
def get_session(
    session_id: str,
    service: Annotated[InterviewService, Depends(get_interview_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> InterviewSessionDetailResponse:
    return service.get_session(actor, session_id)


@router.post(
    "/sessions/{session_id}/answers",
    response_model=InterviewAnswerResponse,
    status_code=201,
)
def submit_answer(
    session_id: str,
    payload: InterviewAnswerRequest,
    service: Annotated[InterviewService, Depends(get_interview_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> InterviewAnswerResponse:
    return service.submit_answer(actor, session_id, payload)
