"""Company deep dive persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

from app.core.auth import CurrentActor
from app.core.owner import owner_eq, owner_fields

COMPANIES_TABLE = "companies"
SAVED_COMPANIES_TABLE = "saved_companies"


class CompanyRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def search_companies(self, *, query: str, location: str | None = None) -> list[dict]:
        qb = self._client.table(COMPANIES_TABLE).select("*").ilike("name", f"%{query}%")
        if location:
            qb = qb.ilike("location", f"%{location}%")
        return qb.execute().data

    def get_company(self, *, company_id: str) -> dict | None:
        rows = (
            self._client.table(COMPANIES_TABLE)
            .select("*")
            .eq("id", company_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def save_company(
        self,
        *,
        actor: CurrentActor,
        company_name: str,
        notes: str | None,
    ) -> dict:
        rows = (
            self._client.table(SAVED_COMPANIES_TABLE)
            .insert(
                {
                    **owner_fields(actor),
                    "company_name": company_name,
                    "notes": notes,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def list_saved_companies(self, *, actor: CurrentActor) -> list[dict]:
        query = self._client.table(SAVED_COMPANIES_TABLE).select("*")
        return owner_eq(query, actor).order("saved_at", desc=True).execute().data

    def delete_saved_company(self, *, actor: CurrentActor, saved_id: str) -> None:
        query = (
            self._client.table(SAVED_COMPANIES_TABLE)
            .delete()
            .eq("id", saved_id)
        )
        owner_eq(query, actor).execute()
