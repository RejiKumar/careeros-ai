"""Feedback router: thin HTTP layer over the feedback service."""

from __future__ import annotations

from typing import Annotated

from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from fastapi import APIRouter, Depends

from .schema import FeedbackRequest, FeedbackResponse
from .service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["feedback"])


def get_feedback_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
) -> FeedbackService:
    return FeedbackService(clients)


@router.post("", response_model=FeedbackResponse, status_code=201)
def submit_feedback(
    payload: FeedbackRequest,
    service: Annotated[FeedbackService, Depends(get_feedback_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> FeedbackResponse:
    return service.upsert(actor, payload)
