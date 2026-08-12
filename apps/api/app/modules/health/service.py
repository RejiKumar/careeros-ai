"""Health use case."""

from __future__ import annotations

from datetime import UTC, datetime

from app import __version__
from app.core.config import Settings

from .schema import HealthResponse


def build_health_report(settings: Settings) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=__version__,
        environment=settings.environment,
        time=datetime.now(UTC),
    )
