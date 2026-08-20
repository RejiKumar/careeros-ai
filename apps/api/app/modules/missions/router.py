"""Missions router."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import CurrentActor, get_current_actor
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .schema import (
    AchievementResponse,
    DashboardResponse,
    MissionCompleteResponse,
    MissionProgressResponse,
    MissionResponse,
)
from .service import MissionService

router = APIRouter(tags=["missions"])


def get_mission_service(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
) -> MissionService:
    return MissionService(clients)


@router.get("/missions", response_model=list[MissionResponse])
def list_missions(
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> list[MissionResponse]:
    return service.list_missions()


@router.get("/missions/progress", response_model=MissionProgressResponse)
def get_progress(
    service: Annotated[MissionService, Depends(get_mission_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> MissionProgressResponse:
    return service.get_progress(actor)


@router.post(
    "/missions/{mission_key}/complete",
    response_model=MissionCompleteResponse,
    status_code=201,
)
def complete_mission(
    mission_key: str,
    service: Annotated[MissionService, Depends(get_mission_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> MissionCompleteResponse:
    return service.complete_mission(actor, mission_key)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    service: Annotated[MissionService, Depends(get_mission_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> DashboardResponse:
    return service.get_dashboard(actor)


@router.get("/achievements", response_model=list[AchievementResponse])
def list_achievements(
    service: Annotated[MissionService, Depends(get_mission_service)],
    actor: Annotated[CurrentActor, Depends(get_current_actor)],
) -> list[AchievementResponse]:
    return service.list_achievements(actor)
