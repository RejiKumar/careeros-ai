"""CareerOS AI FastAPI application entrypoint."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.modules.application_tracker.router import router as application_tracker_router
from app.modules.assessments.router import router as assessments_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.career_path.router import router as career_path_router
from app.modules.coach.router import router as coach_router
from app.modules.company_deep_dive.router import router as company_deep_dive_router
from app.modules.feedback.router import router as feedback_router
from app.modules.health.router import router as health_router
from app.modules.interviews.router import router as interviews_router
from app.modules.job_match.router import router as job_match_router
from app.modules.job_search.router import router as job_search_router
from app.modules.market_pulse.router import router as market_pulse_router
from app.modules.missions.router import router as missions_router
from app.modules.notifications.router import router as notifications_router
from app.modules.notifications.scheduler import start_notification_scheduler
from app.modules.resume_tailor.router import router as resume_tailor_router
from app.modules.resumes.router import router as resumes_router
from app.modules.rewrites.router import router as rewrites_router
from app.modules.roast.router import router as roast_router
from app.modules.salary_negotiator.router import router as salary_negotiator_router
from app.modules.skills_gap.router import router as skills_gap_router
from app.modules.wrapped.router import router as wrapped_router

logger = logging.getLogger(__name__)

API_V1_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    scheduler = None
    try:
        scheduler = start_notification_scheduler(settings)
    except Exception:
        logger.exception("Failed to start notification scheduler; continuing without it.")
    yield
    if scheduler is not None:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            logger.exception("Failed to stop notification scheduler cleanly.")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="CareerOS AI API",
        version=__version__,
        description="Trusted API for CareerOS AI. AI output is always reviewable.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(health_router, prefix=API_V1_PREFIX)
    app.include_router(interviews_router, prefix=API_V1_PREFIX)
    app.include_router(auth_router, prefix=API_V1_PREFIX)
    app.include_router(resumes_router, prefix=API_V1_PREFIX)
    app.include_router(resume_tailor_router, prefix=API_V1_PREFIX)
    app.include_router(application_tracker_router, prefix=API_V1_PREFIX)
    app.include_router(assessments_router, prefix=API_V1_PREFIX)
    app.include_router(job_match_router, prefix=API_V1_PREFIX)
    app.include_router(market_pulse_router, prefix=API_V1_PREFIX)
    app.include_router(job_search_router, prefix=API_V1_PREFIX)
    app.include_router(rewrites_router, prefix=API_V1_PREFIX)
    app.include_router(coach_router, prefix=API_V1_PREFIX)
    app.include_router(feedback_router, prefix=API_V1_PREFIX)
    app.include_router(missions_router, prefix=API_V1_PREFIX)
    app.include_router(notifications_router, prefix=API_V1_PREFIX)
    app.include_router(roast_router, prefix=API_V1_PREFIX)
    app.include_router(skills_gap_router, prefix=API_V1_PREFIX)
    app.include_router(wrapped_router, prefix=API_V1_PREFIX)
    app.include_router(billing_router, prefix=API_V1_PREFIX)
    app.include_router(company_deep_dive_router, prefix=API_V1_PREFIX)
    app.include_router(salary_negotiator_router, prefix=API_V1_PREFIX)
    app.include_router(career_path_router, prefix=API_V1_PREFIX)

    @app.get("/health", tags=["health"])
    def root_health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
