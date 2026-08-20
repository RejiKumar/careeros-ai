"""Rewrite router: thin HTTP layer over the rewrite service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentUser, get_current_user
from app.core.i18n import get_request_locale
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    RewriteAcceptedResponse,
    RewriteAcceptRequest,
    RewriteBatchResponse,
)
from .service import RewriteService

router = APIRouter(prefix="/resumes", tags=["rewrites"])


def get_rewrite_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> RewriteService:
    return RewriteService(clients, provider)


@router.post("/{resume_id}/rewrites", response_model=RewriteBatchResponse, status_code=201)
def create_rewrite_batch(
    resume_id: str,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[RewriteService, Depends(get_rewrite_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> RewriteBatchResponse:
    return service.create_batch(user, resume_id, locale=locale)


@router.get("/{resume_id}/rewrites", response_model=list[RewriteBatchResponse])
def list_rewrite_batches(
    resume_id: str,
    service: Annotated[RewriteService, Depends(get_rewrite_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[RewriteBatchResponse]:
    return service.list_batches(user, resume_id)


@router.get(
    "/{resume_id}/rewrites/{rewrite_id}",
    response_model=RewriteBatchResponse,
)
def get_rewrite_batch(
    resume_id: str,
    rewrite_id: str,
    service: Annotated[RewriteService, Depends(get_rewrite_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> RewriteBatchResponse:
    return service.get_batch(user, resume_id, rewrite_id)


@router.post(
    "/{resume_id}/rewrites/{rewrite_id}/accept",
    response_model=RewriteAcceptedResponse,
    status_code=201,
)
def accept_rewrite_batch(
    resume_id: str,
    rewrite_id: str,
    payload: RewriteAcceptRequest,
    service: Annotated[RewriteService, Depends(get_rewrite_service)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> RewriteAcceptedResponse:
    return service.accept_batch(user, resume_id, rewrite_id, payload.accepted_data)
