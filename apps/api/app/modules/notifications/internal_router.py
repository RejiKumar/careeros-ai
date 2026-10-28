"""Internal reminder trigger: out-of-band invocation of due reminders.

Deliberately mounted **outside** the versioned ``/api/v1`` surface. This is
platform plumbing for an external scheduler, not part of the public API
contract, and it must never be reachable by end-user clients.

Authorisation is a shared secret compared in constant time. End-user bearer
tokens and guest identifiers are deliberately *not* accepted here: possession of
the scheduler credential is the only thing that opens this endpoint.

Why a shared secret rather than platform IAM: authenticating at the platform
level would apply to the whole service, which would lock out the mobile client,
and verifying a scheduler OIDC token would add a JWT dependency for one internal
route. The blast radius of a leaked secret is bounded — the operation is
idempotent per recipient per day and the response carries counts only — so the
worst case is a redundant evaluation, which de-duplication already absorbs.

Keep this router free of any response that could disclose user data.
"""

from __future__ import annotations

import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

from app.core.auth import UnauthenticatedError
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.integrations.supabase.client import SupabaseClients, get_supabase_clients

from .scheduler import build_notification_scheduler
from .schema import ReminderRunResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/notifications", tags=["internal"])

SCHEDULER_SECRET_HEADER = "X-Scheduler-Secret"  # noqa: S105 - header name, not a secret


def require_scheduler_secret(
    settings: Annotated[Settings, Depends(get_settings)],
    x_scheduler_secret: Annotated[str | None, Header(alias=SCHEDULER_SECRET_HEADER)] = None,
) -> None:
    """Authorise an external scheduler using the shared secret.

    Compared with :func:`secrets.compare_digest` so the check does not leak the
    expected value through response timing. When the secret is unconfigured the
    endpoint refuses every caller and says so at error level, naming the missing
    prerequisite rather than degrading silently.
    """
    expected = settings.scheduler_secret
    if not expected:
        logger.error(
            "Reminder trigger refused: CAREEROS_SCHEDULER_SECRET is not configured in "
            "environment %r. Due reminders cannot be evaluated until it is set.",
            settings.environment,
        )
        raise AppError(
            code="scheduler_not_configured",
            message="The reminder trigger is not configured on this deployment.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    provided = x_scheduler_secret or ""
    if not secrets.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        raise UnauthenticatedError("invalid_scheduler_secret", "Invalid scheduler credential.")


@router.post("/run-due", response_model=ReminderRunResponse)
def run_due_reminders(
    _: Annotated[None, Depends(require_scheduler_secret)],
    clients: Annotated[SupabaseClients, Depends(get_supabase_clients)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReminderRunResponse:
    """Evaluate and deliver every due reminder in a single pass.

    Authorisation is declared first so an unauthorised caller never triggers
    Supabase client construction. Failures are logged at error level with the
    environment and reminder counts, because on a container host the log sink is
    the only signal that outlives the failed process.
    """
    try:
        scheduler = build_notification_scheduler(clients, settings)
        summary = scheduler.run_due()
    except Exception:
        logger.exception(
            "Due-reminder evaluation failed in environment %r. Reminders due in this "
            "interval were NOT delivered.",
            settings.environment,
        )
        raise

    logger.info(
        "Due-reminder evaluation completed in environment %r: followup=%d mission=%d",
        settings.environment,
        summary.get("followup", 0),
        summary.get("mission", 0),
    )
    return ReminderRunResponse(
        followup=summary.get("followup", 0),
        mission=summary.get("mission", 0),
    )
