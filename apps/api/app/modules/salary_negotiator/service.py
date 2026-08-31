"""Salary negotiation use cases: estimate ranges and generate scripts.

AI output is always reviewable before becoming user content. Salary data is
advisory only and should be validated against real market conditions.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import SalaryRepository
from .schema import (
    BenefitsComparison,
    BenefitsComparisonResponse,
    NegotiationResponse,
    NegotiationScript,
    SalaryRangeResponse,
)


class SalaryAiError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The salary analysis could not be generated right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class SalaryNegotiatorService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        service_client = require_service_client(clients)
        self._provider = provider
        self._repository = SalaryRepository(service_client)

    def get_salary_range(
        self,
        actor: CurrentActor,
        *,
        role: str,
        location: str,
        experience_years: int | None = None,
        skills: list[str] | None = None,
        company: str | None = None,
    ) -> NegotiationResponse:
        try:
            result = self._provider.generate_salary_analysis(
                role=role,
                location=location,
                experience_years=experience_years,
                skills=skills,
                company=company,
            )
        except ProviderError as exc:
            raise SalaryAiError() from exc

        range_content = result.content.salary_range
        script_content = result.content.script
        now = datetime.now(UTC).isoformat()
        return NegotiationResponse(
            salary_range=SalaryRangeResponse(
                role=role,
                location=location,
                min_salary=range_content.min_salary,
                max_salary=range_content.max_salary,
                median_salary=range_content.median_salary,
                currency=range_content.currency,
                experience_level=range_content.experience_level,
                confidence=range_content.confidence,
            ),
            script=NegotiationScript(
                opening=script_content.opening,
                justification_points=script_content.justification_points,
                handling_objections=script_content.handling_objections,
                closing=script_content.closing,
            ),
            generated_at=now,
        )

    def get_benefits_comparison(
        self,
        actor: CurrentActor,
        *,
        role: str,
        company: str | None = None,
    ) -> BenefitsComparisonResponse:
        benefits = [
            BenefitsComparison(
                item="Health Insurance",
                typical="Group health cover for employee + family",
                negotiable=True,
            ),
            BenefitsComparison(
                item="Performance Bonus",
                typical="5-15% of base salary",
                negotiable=True,
            ),
            BenefitsComparison(
                item="Stock Options / ESOP",
                typical="Varies by stage and role",
                negotiable=True,
            ),
            BenefitsComparison(
                item="Paid Time Off",
                typical="15-25 days per year",
                negotiable=True,
            ),
            BenefitsComparison(
                item="Remote Work",
                typical="2-3 days per week hybrid",
                negotiable=True,
            ),
            BenefitsComparison(
                item="Learning Budget",
                typical="INR 25,000-1,00,000 per year",
                negotiable=True,
            ),
            BenefitsComparison(
                item="Joining Bonus",
                typical="0-2 months salary",
                negotiable=True,
            ),
        ]
        now = datetime.now(UTC).isoformat()
        return BenefitsComparisonResponse(benefits=benefits, generated_at=now)
