"""Career path router: thin HTTP layer over the career path service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.ai_quota import ai_quota
from app.core.auth import CurrentActor, get_current_actor
from app.core.i18n import get_request_locale
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    CareerPathRequest,
    CareerPathResponse,
    SavedCareerPathResponse,
)
from .service import CareerPathService

router = APIRouter(prefix="/career-path", tags=["career-path"])


def get_career_path_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> CareerPathService:
    return CareerPathService(clients, provider)


@router.post(
    "/generate", response_model=CareerPathResponse, dependencies=[Depends(ai_quota("career_path"))]
)
def generate_career_path(
    payload: CareerPathRequest,
    locale: Annotated[str, Depends(get_request_locale)],
    service: Annotated[CareerPathService, Depends(get_career_path_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> CareerPathResponse:
    return service.generate_career_path(
        actor,
        resume_id=payload.resume_id,
        target_role=payload.target_role,
        locale=locale,
    )


@router.get("/{path_id}", response_model=CareerPathResponse)
def get_career_path(
    path_id: str,
    service: Annotated[CareerPathService, Depends(get_career_path_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> CareerPathResponse:
    return service.get_career_path(actor, path_id=path_id)


@router.get("", response_model=list[SavedCareerPathResponse])
def list_career_paths(
    service: Annotated[CareerPathService, Depends(get_career_path_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[SavedCareerPathResponse]:
    return service.list_career_paths(actor)


@router.delete("/{path_id}", status_code=204)
def delete_career_path(
    path_id: str,
    service: Annotated[CareerPathService, Depends(get_career_path_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_career_path(actor, path_id=path_id)
