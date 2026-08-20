"""Actor-aware ownership helpers for repositories and services."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.core.auth import CurrentActor


def owner_column(actor: CurrentActor) -> str:
    """The ownership column for this actor (guest_id or user_id).

    Accepts CurrentUser too (always treated as a user) via duck typing.
    """
    return "guest_id" if getattr(actor, "kind", None) == "guest" else "user_id"


def owner_fields(actor: CurrentActor) -> dict[str, str]:
    """The ownership fields to write when creating a row for this actor."""
    return {owner_column(actor): actor.id}


@runtime_checkable
class OwnerQuery(Protocol):
    """Minimal Supabase query builder surface used for ownership filters."""

    def eq(self, column: str, value: object) -> OwnerQuery: ...


def owner_eq(query: OwnerQuery, actor: CurrentActor) -> OwnerQuery:
    """Filter a Supabase query to rows owned by this actor."""
    return query.eq(owner_column(actor), actor.id)
