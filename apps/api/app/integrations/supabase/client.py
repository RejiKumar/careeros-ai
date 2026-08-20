"""Supabase integration client access.

Only this module constructs Supabase clients. Provider types stay inside
integrations; domain code consumes typed repositories/services instead.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import Settings, get_settings

from .auth import verify_access_token


class SupabaseClients:
    """Holds public (anon) and server (service-role) Supabase clients."""

    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise ValueError("supabase_url and supabase_anon_key are required")
        self.anon_client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
        if settings.supabase_service_role_key:
            self.service_client: Client | None = create_client(
                settings.supabase_url, settings.supabase_service_role_key
            )
        else:
            self.service_client = None

    def verify_jwt(self, access_token: str) -> dict:
        """Verify a user's Supabase access JWT and return its claims.

        Raises an AuthVerificationError when the token is missing, invalid or expired.
        """
        return verify_access_token(self.anon_client, access_token)


@lru_cache
def get_supabase_clients() -> SupabaseClients:
    return SupabaseClients(get_settings())


def require_service_client(clients: SupabaseClients) -> Client:
    if clients.service_client is None:
        raise ValueError("Supabase service-role client is not configured")
    return clients.service_client


def ensure_guest_account(clients: SupabaseClients, guest_id: str) -> None:
    """Create the guest_accounts row if missing (idempotent)."""
    service_client = require_service_client(clients)
    existing = (
        service_client.table("guest_accounts").select("id").eq("id", guest_id).execute().data
    )
    if not existing:
        service_client.table("guest_accounts").insert({"id": guest_id}).execute()
