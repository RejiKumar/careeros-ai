"""Coach router: thin HTTP layer over the coach service."""

from __future__ import annotations

from typing import Annotated

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentUser, get_current_user
from app.core.i18n import get_request_locale
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from fastapi import APIRouter, Depends

from .schema import (
    CoachMessagePairResponse,
    CoachMessageRequest,
    CoachThreadCreateRequest,
    CoachThreadDetailResponse,
    CoachThreadResponse,
    CoachThreadUpdateRequest,
)
from .service import CoachService

router = APIRouter(prefix="/coach", tags=["coach"])


def get_coach_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> CoachService:
    return CoachService(clients, provider)


@router.post("/threads", response_model=CoachThreadResponse, status_code=201)
def create_thread(
    payload: CoachThreadCreateRequest,
    service: Annotated[CoachService, Depends(get_coach_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CoachThreadResponse:
    return service.create_thread(
        user, payload.title, payload.resume_id, payload.job_description_id
    )


@router.get("/threads", response_model=list[CoachThreadResponse])
def list_threads(
    service: Annotated[CoachService, Depends(get_coach_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[CoachThreadResponse]:
    return service.list_threads(user)


@router.get("/threads/{thread_id}", response_model=CoachThreadDetailResponse)
def get_thread(
    thread_id: str,
    service: Annotated[CoachService, Depends(get_coach_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
) -> CoachThreadDetailResponse:
    return service.get_thread_detail(user, thread_id, limit=limit, offset=offset)


@router.patch("/threads/{thread_id}", response_model=CoachThreadResponse)
def update_thread(
    thread_id: str,
    payload: CoachThreadUpdateRequest,
    service: Annotated[CoachService, Depends(get_coach_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CoachThreadResponse:
    return service.update_thread(
        user,
        thread_id,
        title=payload.title,
        resume_id=payload.resume_id,
        job_description_id=payload.job_description_id,
    )


@router.delete("/threads/{thread_id}", status_code=204)
def delete_thread(
    thread_id: str,
    service: Annotated[CoachService, Depends(get_coach_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    service.delete_thread(user, thread_id)


@router.post(
    "/threads/{thread_id}/messages",
    response_model=CoachMessagePairResponse,
    status_code=201,
)
def send_message(
    thread_id: str,
    payload: CoachMessageRequest,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[CoachService, Depends(get_coach_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CoachMessagePairResponse:
    return service.post_message(user, thread_id, payload.content, locale=locale)
