"""Mock job search provider.

Returns sample results so development/offline still works. Never treated as
real job data; results are clearly marked as samples by the caller's source.
"""

from __future__ import annotations

import uuid

from app.modules.job_search.schema import JobSearchResult

from .provider import JobSearchProvider


class MockJobSearchProvider(JobSearchProvider):
    def search(
        self,
        query: str,
        location: str | None,
        source: str | None,
        page: int,
        limit: int,
    ) -> list[JobSearchResult]:
        mock_source = self._resolve_source(source)
        count = min(limit, 5)
        return [
            JobSearchResult(
                id=str(uuid.uuid4()),
                title=f"Senior {query.title()} Engineer" if query else "Senior Professional",
                company="Acme Corp",
                location=location or "Remote",
                source=mock_source,
                url=f"https://example.com/jobs/{i}",
                description=(
                    f"We are looking for a {query or 'skilled'} professional to join our team."
                ),
                skills=[query] if query else ["problem solving", "communication"],
                posted_date="2026-08-20",
                salary_range="$80,000 - $120,000",
                match_score=None,
            )
            for i in range(count)
        ]

    def _resolve_source(self, source: str | None) -> str:
        return source if source and source != "all" else "linkedin"
