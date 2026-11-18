"""Primary-with-fallback job search composition.

Tries the primary provider (real-time, small quota) first and falls back to a
secondary provider when the primary fails or returns nothing. After a quota
error the primary is skipped for a cool-down window so an exhausted monthly
quota does not add a failing round trip to every search.

The cool-down is per process: on scale-to-zero hosts a fresh instance may probe
the primary once more, which costs one rejected request and is harmless.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable

from app.modules.job_search.schema import JobSearchResult

from .provider import JobSearchProvider, JobSearchProviderError, JobSearchQuotaError

logger = logging.getLogger(__name__)

DEFAULT_COOLDOWN_SECONDS = 6 * 60 * 60


class ProviderCooldown:
    """Thread-safe 'skip until' marker shared across requests."""

    def __init__(self) -> None:
        self._until = 0.0
        self._lock = threading.Lock()

    def active(self, now: float) -> bool:
        with self._lock:
            return now < self._until

    def start(self, now: float, seconds: float) -> None:
        with self._lock:
            self._until = now + seconds

    def reset(self) -> None:
        with self._lock:
            self._until = 0.0


PRIMARY_COOLDOWN = ProviderCooldown()


class FallbackJobSearchProvider(JobSearchProvider):
    def __init__(
        self,
        primary: JobSearchProvider,
        fallback: JobSearchProvider,
        *,
        cooldown: ProviderCooldown = PRIMARY_COOLDOWN,
        cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.primary = primary
        self.fallback = fallback
        self._cooldown = cooldown
        self._cooldown_seconds = cooldown_seconds
        self._clock = clock

    def search(
        self,
        query: str,
        location: str | None,
        source: str | None,
        page: int,
        limit: int,
    ) -> list[JobSearchResult]:
        if not self._cooldown.active(self._clock()):
            try:
                results = self.primary.search(query, location, source, page, limit)
            except JobSearchQuotaError:
                logger.warning("Primary job search quota exhausted; using fallback.")
                self._cooldown.start(self._clock(), self._cooldown_seconds)
            except JobSearchProviderError:
                logger.warning("Primary job search failed; using fallback.")
            else:
                if results:
                    return results
        return self.fallback.search(query, location, source, page, limit)
