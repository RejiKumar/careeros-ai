"""Market Pulse read-only persistence backed by Supabase (service-role client).

This is aggregated public data — no ownership filtering required.
"""

from __future__ import annotations

from supabase import Client

SKILL_DEMANDS_TABLE = "skill_demands"
SALARY_DATA_TABLE = "salary_data"
COMPANY_DATA_TABLE = "company_data"


class MarketPulseRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_skill_demands(
        self,
        *,
        location: str | None = None,
        period: str | None = None,
    ) -> list[dict]:
        query = self._client.table(SKILL_DEMANDS_TABLE).select("*")
        if location:
            query = query.eq("location", location)
        if period:
            query = query.eq("period", period)
        return query.order("demand_score", desc=True).execute().data

    def get_salary_ranges(
        self,
        *,
        location: str | None = None,
        role: str | None = None,
    ) -> list[dict]:
        query = self._client.table(SALARY_DATA_TABLE).select("*")
        if location:
            query = query.eq("location", location)
        if role:
            query = query.ilike("role", f"%{role}%")
        return query.order("median_salary", desc=True).execute().data

    def get_top_companies(
        self,
        *,
        location: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        query = self._client.table(COMPANY_DATA_TABLE).select("*")
        if location:
            query = query.eq("location", location)
        return query.order("job_count", desc=True).limit(limit).execute().data

    def get_skill_trends(
        self,
        *,
        period: str | None = None,
        location: str | None = None,
    ) -> list[dict]:
        query = self._client.table(SKILL_DEMANDS_TABLE).select("*")
        if period:
            query = query.eq("period", period)
        if location:
            query = query.eq("location", location)
        return query.order("change_percent", desc=True).execute().data
