"""Application tracker router: thin HTTP layer over the application service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    ApplicationRequest,
    ApplicationResponse,
    ApplicationStatsResponse,
    ApplicationUpdateRequest,
)
from .service import ApplicationService

router = APIRouter(prefix="/applications", tags=["applications"])


def get_application_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
) -> ApplicationService:
    return ApplicationService(clients)


@router.post("", response_model=ApplicationResponse, status_code=201)
def create_application(
    payload: ApplicationRequest,
    service: Annotated[ApplicationService, Depends(get_application_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> ApplicationResponse:
    return service.create_application(
        actor,
        job_id=payload.job_id,
        job_title=payload.job_title,
        company=payload.company,
        status=payload.status,
        notes=payload.notes,
        url=payload.url,
        applied_at=payload.applied_at,
        interview_date=payload.interview_date,
        follow_up_date=payload.follow_up_date,
    )


@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    service: Annotated[ApplicationService, Depends(get_application_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
    status_filter: str | None = None,
) -> list[ApplicationResponse]:
    return service.list_applications(actor, status_filter=status_filter)


@router.get("/stats", response_model=ApplicationStatsResponse)
def get_stats(
    service: Annotated[ApplicationService, Depends(get_application_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> ApplicationStatsResponse:
    return service.get_stats(actor)


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: str,
    service: Annotated[ApplicationService, Depends(get_application_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> ApplicationResponse:
    return service.get_application(actor, application_id=application_id)


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: str,
    payload: ApplicationUpdateRequest,
    service: Annotated[ApplicationService, Depends(get_application_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> ApplicationResponse:
    return service.update_application(
        actor,
        application_id=application_id,
        status=payload.status,
        notes=payload.notes,
        interview_date=payload.interview_date,
        follow_up_date=payload.follow_up_date,
    )


@router.delete("/{application_id}", status_code=204)
def delete_application(
    application_id: str,
    service: Annotated[ApplicationService, Depends(get_application_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_application(actor, application_id=application_id)

