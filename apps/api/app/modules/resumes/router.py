"""Resume router: thin HTTP layer over the resume service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    ResumeDetailResponse,
    ResumeImportResponse,
    ResumeResponse,
    ResumeUpdateRequest,
    ResumeVersionResponse,
)
from .service import ResumeService

router = APIRouter(prefix="/resumes", tags=["resumes"])


def get_resume_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> ResumeService:
    return ResumeService(clients, provider)


@router.post("/import", response_model=ResumeImportResponse, status_code=201)
def import_resume(
    service: Annotated[ResumeService, Depends(get_resume_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
    file: Annotated[UploadFile, File(description="Resume file: PDF, DOCX or TXT, max 10 MB")],
) -> ResumeImportResponse:
    content = file.file.read()
    return service.import_resume(
        actor,
        filename=file.filename or "",
        content_type=file.content_type,
        content=content,
    )


@router.get("", response_model=list[ResumeResponse])
def list_resumes(
    service: Annotated[ResumeService, Depends(get_resume_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[ResumeResponse]:
    return service.list_resumes(actor)


@router.get("/{resume_id}", response_model=ResumeDetailResponse)
def get_resume(
    resume_id: str,
    service: Annotated[ResumeService, Depends(get_resume_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> ResumeDetailResponse:
    return service.get_resume(actor, resume_id)


@router.get("/{resume_id}/versions", response_model=list[ResumeVersionResponse])
def list_resume_versions(
    resume_id: str,
    service: Annotated[ResumeService, Depends(get_resume_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[ResumeVersionResponse]:
    return service.list_versions(actor, resume_id)


@router.patch("/{resume_id}", response_model=ResumeDetailResponse)
def update_resume(
    resume_id: str,
    payload: ResumeUpdateRequest,
    service: Annotated[ResumeService, Depends(get_resume_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> ResumeDetailResponse:
    return service.update_resume(
        actor,
        resume_id,
        title=payload.title,
        structured_data=payload.structured_data,
    )

