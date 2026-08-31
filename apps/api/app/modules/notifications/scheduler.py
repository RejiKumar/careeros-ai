"""Background notification scheduler.

Runs on a timer (APScheduler) and sends grounded, reviewable reminders derived
from real user data — never fabricated content. Each reminder respects the
actor's notification preferences and is de-duplicated per day via
notification_logs so users are not spammed.

Two reminder types are emitted:
- ``followup``: applications with an interview or follow-up date today.
- ``mission``: a daily mission-streak nudge when active missions exist but
  none were completed today.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.auth import CurrentActor
from app.core.config import Settings
from app.integrations.firebase import fcm
from app.integrations.supabase.client import SupabaseClients

from .repository import NotificationRepository
from .service import NotificationService

logger = logging.getLogger(__name__)

REMINDER_FOLLOWUP = "followup"
REMINDER_MISSION = "mission"


class NotificationScheduler:
    def __init__(self, clients: SupabaseClients, settings: Settings) -> None:
        service_client = clients.service_client
        if service_client is None:
            raise ValueError("Supabase service-role client is required for the scheduler.")
        self._repository = NotificationRepository(service_client)
        self._service = NotificationService(clients, settings)
        self._settings = settings

    def run_due(self, *, today: date | None = None) -> dict[str, int]:
        """Emit due reminders; returns a count summary.

        When FCM is not configured this still evaluates candidates and records
        the counts, but skips the actual push (safe no-op in dev).
        """
        today = today or datetime.now(tz=UTC).date()
        today_iso = today.isoformat()
        summary = {REMINDER_FOLLOWUP: 0, REMINDER_MISSION: 0}
        has_push = fcm.is_fcm_available(self._settings)

        for pref in self._repository.list_preference_rows():
            actor = _owner_actor(pref)
            if actor is None:
                continue
            if not self._repository.list_fcm_tokens_for_owner(actor=actor):
                continue

            if pref.get("mission_reminders", True):
                self._maybe_send_mission(actor, today_iso, summary, has_push=has_push)
            if pref.get("job_alerts", True):
                self._maybe_send_followup(actor, today_iso, summary, has_push=has_push)

        return summary

    def _maybe_send_mission(
        self, actor: CurrentActor, today_iso: str, summary: dict[str, int], *, has_push: bool
    ) -> None:
        if not self._repository.has_active_missions():
            return
        if self._repository.completed_any_today(actor=actor, today_iso=today_iso):
            return
        if self._repository.has_logged_today(
            actor=actor, notification_type=REMINDER_MISSION, today_iso=today_iso
        ):
            return
        if has_push:
            self._service.send_notification(
                actor=actor,
                title="You have missions to complete today",
                body="Complete today's missions to keep your streak going.",
                data={"type": REMINDER_MISSION},
                notification_type=REMINDER_MISSION,
            )
        summary[REMINDER_MISSION] += 1

    def _maybe_send_followup(
        self, actor: CurrentActor, today_iso: str, summary: dict[str, int], *, has_push: bool
    ) -> None:
        due = [
            row
            for row in self._repository.list_applications_due(
                owner_type=owner_column(actor), owner_id=actor.id, today_iso=today_iso
            )
            if _is_due_today(row, today_iso)
        ]
        if not due:
            return
        if self._repository.has_logged_today(
            actor=actor, notification_type=REMINDER_FOLLOWUP, today_iso=today_iso
        ):
            return
        first = due[0]
        company = first.get("company") or "a company"
        title = first.get("job_title") or "an application"
        if has_push:
            self._service.send_notification(
                actor=actor,
                title=f"Action needed: {company}",
                body=f"Your application for {title} has a date today. Follow up to keep it moving.",
                data={"type": REMINDER_FOLLOWUP},
                notification_type=REMINDER_FOLLOWUP,
            )
        summary[REMINDER_FOLLOWUP] += 1


def _is_due_today(row: dict, today_iso: str) -> bool:
    return (row.get("interview_date") or row.get("follow_up_date")) == today_iso


def _owner_actor(row: dict) -> CurrentActor | None:
    if row.get("user_id"):
        return CurrentActor(id=row["user_id"], kind="user")
    if row.get("guest_id"):
        return CurrentActor(id=row["guest_id"], kind="guest")
    return None


def owner_column(actor: CurrentActor) -> str:
    return "guest_id" if actor.kind == "guest" else "user_id"


def build_notification_scheduler(
    clients: SupabaseClients, settings: Settings
) -> NotificationScheduler:
    return NotificationScheduler(clients, settings)


def start_notification_scheduler(settings: Settings) -> BackgroundScheduler | None:
    """Start the in-process reminder scheduler if a service-role client exists.

    Deployed in prod and qa only. Returns None when not applicable (e.g. dev
    without a backend key). Returns the running scheduler for shutdown.
    """
    if settings.environment not in ("prod", "qa"):
        return None
    if not settings.supabase_service_role_key:
        logger.warning("Scheduler skipped: no service-role key configured.")
        return None
    clients = SupabaseClients(settings)
    scheduler = build_notification_scheduler(clients, settings)
    interval_minutes = 60

    _schedule = BackgroundScheduler(daemon=True)
    _schedule.add_job(
        scheduler.run_due,
        "interval",
        minutes=interval_minutes,
        id="notification_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _schedule.start()
    logger.info("Notification scheduler started (every %s min).", interval_minutes)
    return _schedule
