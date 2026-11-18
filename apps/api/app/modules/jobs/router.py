"""Jobs router: server-to-server triggers for scheduled work.

Used on scale-to-zero hosts where an in-process timer cannot run reliably.
An external scheduler (e.g. Cloud Scheduler) calls these endpoints with the
shared ``X-Cron-Secret`` header. When no secret is configured the endpoints
behave as if they do not exist.
"""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients
from app.modules.notifications.scheduler import build_notification_scheduler

router = APIRouter(prefix="/jobs", tags=["jobs"], include_in_schema=False)


class ReminderRunResponse(BaseModel):
    followup: int
    mission: int


def require_cron_secret(
    settings: Annotated[Settings, Depends(get_settings)],
    x_cron_secret: Annotated[str | None, Header()] = None,
) -> None:
    if not settings.cron_secret:
        raise AppError(code="not_found", message="Not found.", status_code=404)
    if x_cron_secret is None or not hmac.compare_digest(
        x_cron_secret.encode(), settings.cron_secret.encode()
    ):
        raise AppError(code="forbidden", message="Invalid job credentials.", status_code=403)


@router.post(
    "/notification-reminders",
    response_model=ReminderRunResponse,
    dependencies=[Depends(require_cron_secret)],
)
def run_notification_reminders(
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReminderRunResponse:
    if clients.service_client is None:
        raise AppError(
            code="service_unavailable",
            message="Scheduled jobs are not configured.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    summary = build_notification_scheduler(clients, settings).run_due()
    return ReminderRunResponse(**summary)
