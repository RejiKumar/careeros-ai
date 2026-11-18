"""Provider-neutral job search interface.

Domain and use-case code depends only on ``JobSearchProvider`` and the shared
result model. Provider SDKs are isolated in sibling modules so a future source
(e.g. a different job board) can implement the same protocol without touching
domain code.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.modules.job_search.schema import JobSearchResult


class JobSearchProviderError(Exception):
    """A job search provider call failed."""


class JobSearchQuotaError(JobSearchProviderError):
    """The provider rejected the call because a plan quota is exhausted."""


class JobSearchProvider:
    """Provider-neutral live job search capabilities."""

    def search(
        self,
        query: str,
        location: str | None,
        source: str | None,
        page: int,
        limit: int,
    ) -> list[JobSearchResult]:
        """Return normalised job results for the given query.

        Result data comes from an external board and must be treated as
        untrusted; it is never treated as ground truth.
        """
        raise NotImplementedError


def build_job_search_provider(settings: Settings) -> JobSearchProvider:
    """Resolve the configured job search provider.

    - JSearch + Adzuna configured: real-time JSearch first, Adzuna on failure,
      empty results or exhausted JSearch quota.
    - Only one configured: that provider alone.
    - Neither: the mock provider so development still works offline.
    """
    adzuna: JobSearchProvider | None = None
    if settings.adzuna_app_id and settings.adzuna_app_key:
        from .adzuna import AdzunaJobSearchProvider

        adzuna = AdzunaJobSearchProvider(
            app_id=settings.adzuna_app_id,
            app_key=settings.adzuna_app_key,
            country=settings.adzuna_country,
        )
    if settings.jsearch_api_key:
        from .jsearch import JSearchJobSearchProvider

        jsearch = JSearchJobSearchProvider(
            api_key=settings.jsearch_api_key, country=settings.jsearch_country
        )
        if adzuna is None:
            return jsearch
        from .fallback import FallbackJobSearchProvider

        return FallbackJobSearchProvider(jsearch, adzuna)
    if adzuna is not None:
        return adzuna
    from .mock import MockJobSearchProvider

    return MockJobSearchProvider()


def get_job_search_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> JobSearchProvider:
    return build_job_search_provider(settings)
