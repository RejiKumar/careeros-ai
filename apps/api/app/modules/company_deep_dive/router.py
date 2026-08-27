"""Company deep dive router: thin HTTP layer over the company service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.provider import CareerAiProvider, get_ai_provider
from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    CompanyJobsResponse,
    CompanyProfileResponse,
    CompanySearchRequest,
    SaveCompanyRequest,
    SavedCompanyResponse,
)
from .service import CompanyService

router = APIRouter(prefix="/companies", tags=["companies"])


def get_company_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    provider: Annotated[CareerAiProvider, Depends(get_ai_provider)],
) -> CompanyService:
    return CompanyService(clients, provider)


@router.post("/search", response_model=list[CompanyProfileResponse])
def search_companies(
    payload: CompanySearchRequest,
    service: Annotated[CompanyService, Depends(get_company_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[CompanyProfileResponse]:
    return service.search_companies(actor, query=payload.query, location=payload.location)


@router.get("/saved", response_model=list[SavedCompanyResponse])
def list_saved_companies(
    service: Annotated[CompanyService, Depends(get_company_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[SavedCompanyResponse]:
    return service.list_saved_companies(actor)


@router.get("/{company_id}", response_model=CompanyProfileResponse)
def get_company_profile(
    company_id: str,
    service: Annotated[CompanyService, Depends(get_company_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> CompanyProfileResponse:
    return service.get_company(actor, company_id=company_id)


@router.get("/{company_id}/jobs", response_model=CompanyJobsResponse)
def get_company_jobs(
    company_id: str,
    service: Annotated[CompanyService, Depends(get_company_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> CompanyJobsResponse:
    return service.get_company_jobs(actor, company_id=company_id)


@router.post("/saved", response_model=SavedCompanyResponse, status_code=201)
def save_company(
    payload: SaveCompanyRequest,
    service: Annotated[CompanyService, Depends(get_company_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> SavedCompanyResponse:
    return service.save_company(actor, company_name=payload.company_name, notes=payload.notes)


@router.delete("/saved/{saved_id}", status_code=204)
def delete_saved_company(
    saved_id: str,
    service: Annotated[CompanyService, Depends(get_company_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> None:
    service.delete_saved_company(actor, saved_id=saved_id)
