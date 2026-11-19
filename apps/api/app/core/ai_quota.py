"""Daily AI usage limits per user or guest.

Every endpoint that calls the AI provider is metered here so a free user cannot
run up the AI bill. The limit is a rolling 24-hour window per owner (guest or
signed-in user), stored in ``ai_usage_events``. An action is recorded only after
it succeeds, so a failed AI call never uses up the allowance. Pro users are
unlimited, and a limit of 0 disables metering for that audience.

If the usage store itself is unavailable the request is allowed and a warning
is logged: a database blip must not take the AI features down.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, status
from pydantic import BaseModel

from app.core.auth import CurrentActor, get_current_actor
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.owner import owner_eq, owner_fields
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

logger = logging.getLogger(__name__)

USAGE_TABLE = "ai_usage_events"
ENTITLEMENTS_TABLE = "entitlements"
WINDOW = timedelta(hours=24)
WINDOW_HOURS = 24


class AiUsage(BaseModel):
    """The caller's AI allowance for the current rolling window."""

    used: int
    limit: int | None
    remaining: int | None
    resets_at: str | None
    window_hours: int = WINDOW_HOURS


class DailyAiLimitReachedError(AppError):
    def __init__(self, *, limit: int, guest: bool, user_limit: int, wait: timedelta) -> None:
        if guest:
            message = (
                f"You've used your {limit} free AI actions for today. "
                f"Create a free account to get {user_limit} a day, or try again in "
                f"{_format_wait(wait)}."
            )
        else:
            message = (
                f"You've used your {limit} AI actions for today. "
                f"Your allowance renews in {_format_wait(wait)}."
            )
        super().__init__(
            code="daily_ai_limit_reached",
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


def _format_wait(wait: timedelta) -> str:
    minutes = max(int(wait.total_seconds() // 60), 1)
    hours, minutes = divmod(minutes, 60)
    if hours and minutes:
        return f"{hours} h {minutes} min"
    if hours:
        return f"{hours} h"
    return f"{minutes} min"


def _parse(timestamp: str) -> datetime:
    parsed = datetime.fromisoformat(timestamp)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


class AiQuota:
    def __init__(
        self,
        clients: SupabaseClients,
        settings: Settings,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._clients = clients
        self._settings = settings
        self._now = now

    # -- policy -----------------------------------------------------------

    def limit_for(self, actor: CurrentActor) -> int | None:
        raw = (
            self._settings.ai_daily_limit_guest
            if actor.kind == "guest"
            else self._settings.ai_daily_limit_user
        )
        return raw if raw > 0 else None

    def _is_pro(self, actor: CurrentActor) -> bool:
        if actor.kind == "guest" or self._clients.service_client is None:
            return False
        rows = (
            self._clients.service_client.table(ENTITLEMENTS_TABLE)
            .select("*")
            .eq("user_id", actor.id)
            .execute()
            .data
        )
        row = rows[0] if rows else {}
        return row.get("plan") == "pro" and row.get("status", "active") == "active"

    # -- reads ------------------------------------------------------------

    def _window_events(self, actor: CurrentActor) -> list[datetime]:
        client = self._clients.service_client
        if client is None:
            return []
        since = (self._now() - WINDOW).isoformat()
        query = client.table(USAGE_TABLE).select("created_at").gte("created_at", since)
        rows = owner_eq(query, actor).execute().data
        return sorted(_parse(row["created_at"]) for row in rows)

    def usage(self, actor: CurrentActor) -> AiUsage:
        limit = self.limit_for(actor)
        try:
            if limit is not None and self._is_pro(actor):
                limit = None
            events = self._window_events(actor)
        except Exception:
            logger.warning("AI usage lookup failed; reporting no usage.", exc_info=True)
            events = []
        used = len(events)
        resets_at = (events[0] + WINDOW).isoformat() if events else None
        remaining = None if limit is None else max(limit - used, 0)
        return AiUsage(used=used, limit=limit, remaining=remaining, resets_at=resets_at)

    # -- enforcement --------------------------------------------------------

    def ensure_available(self, actor: CurrentActor) -> None:
        limit = self.limit_for(actor)
        if limit is None:
            return
        try:
            events = self._window_events(actor)
            if len(events) < limit or self._is_pro(actor):
                return
        except Exception:
            logger.warning("AI quota check failed; allowing the request.", exc_info=True)
            return
        # The allowance frees up when the oldest counted action leaves the window.
        wait = max(events[0] + WINDOW - self._now(), timedelta(minutes=1))
        raise DailyAiLimitReachedError(
            limit=limit,
            guest=actor.kind == "guest",
            user_limit=self._settings.ai_daily_limit_user,
            wait=wait,
        )

    def record(self, actor: CurrentActor, feature: str) -> None:
        client = self._clients.service_client
        if client is None or self.limit_for(actor) is None:
            return
        try:
            client.table(USAGE_TABLE).insert(
                {
                    **owner_fields(actor),
                    "feature": feature,
                    "created_at": self._now().isoformat(),
                }
            ).execute()
        except Exception:
            logger.warning("Could not record AI usage.", exc_info=True)


def ai_quota(feature: str) -> Callable[..., Iterator[None]]:
    """Route dependency: reject over-limit callers, and count the action on success."""

    def dependency(
        actor: Annotated[CurrentActor, Depends(get_current_actor)],
        clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
        settings: Annotated[Settings, Depends(get_settings)],
    ) -> Iterator[None]:
        quota = AiQuota(clients, settings)
        quota.ensure_available(actor)
        yield
        # Not reached when the endpoint raised, so failed AI calls are free.
        quota.record(actor, feature)

    return dependency
