"""Career path use cases: map career progression from resume data.

AI output is always reviewable before becoming user content. Career path
estimates are advisory only and should be validated against real market
conditions.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import CareerPathRepository
from .schema import (
    CareerPathResponse,
    CareerStage,
    SavedCareerPathResponse,
)


class CareerPathAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The career path could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class CareerPathNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Career path not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class CareerPathService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._repository = CareerPathRepository(service_client)

    def generate_career_path(
        self,
        actor: CurrentActor,
        *,
        resume_id: str,
        target_role: str | None = None,
    ) -> CareerPathResponse:
        try:
            result = self._provider.generate_career_path(
                resume_id=resume_id,
                target_role=target_role,
            )
        except ProviderError as exc:
            raise CareerPathAiError() from exc

        now = datetime.now(UTC).isoformat()
        path_response = CareerPathResponse(
            current_stage=result.get("current_stage", ""),
            stages=[
                CareerStage(
                    title=s["title"],
                    description=s["description"],
                    typical_years=s["typical_years"],
                    required_skills=s.get("required_skills", []),
                    recommended_actions=s.get("recommended_actions", []),
                )
                for s in result.get("stages", [])
            ],
            gap_analysis=result.get("gap_analysis", []),
            timeline_estimate=result.get("timeline_estimate", ""),
            generated_at=now,
        )

        import json

        self._repository.create(
            actor=actor,
            target_role=target_role or "",
            path_data=json.dumps(path_response.model_dump()),
        )

        return path_response

    def get_career_path(
        self,
        actor: CurrentActor,
        *,
        path_id: str,
    ) -> CareerPathResponse:
        row = self._repository.get(actor=actor, path_id=path_id)
        if row is None:
            raise CareerPathNotFoundError()
        import json

        return CareerPathResponse.model_validate(json.loads(row["path_data"]))

    def list_career_paths(
        self,
        actor: CurrentActor,
    ) -> list[SavedCareerPathResponse]:
        rows = self._repository.list_by_user(actor=actor)
        return [
            SavedCareerPathResponse(
                id=row["id"],
                user_id=row.get("user_id") or row.get("guest_id") or "",
                target_role=row["target_role"],
                path_data=row["path_data"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def delete_career_path(
        self,
        actor: CurrentActor,
        *,
        path_id: str,
    ) -> None:
        existing = self._repository.get(actor=actor, path_id=path_id)
        if existing is None:
            raise CareerPathNotFoundError()
        self._repository.delete(actor=actor, path_id=path_id)
