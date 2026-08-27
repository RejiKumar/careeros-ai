"""Salary data persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

SALARY_DATA_TABLE = "salary_data"


class SalaryRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_salary_data(self, *, role: str, location: str) -> dict | None:
        rows = (
            self._client.table(SALARY_DATA_TABLE)
            .select("*")
            .eq("role", role)
            .eq("location", location)
            .execute()
            .data
        )
        return rows[0] if rows else None
