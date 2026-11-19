"""Company deep dive use cases: search, profile, jobs and saved companies.

Company profiles are built from real, live job postings returned by the job
search provider (JSearch with an Adzuna fallback). Only facts present in those
postings are reported: the company's name, where it is hiring, how many open
postings were found, the technologies its postings mention and links to the
postings themselves. Fields no source provides (team size, funding, culture)
are left empty rather than invented.
"""

from __future__ import annotations

import base64
import binascii
import re
import threading
import time
from collections import Counter

from fastapi import status

from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.integrations.job_search.provider import JobSearchProvider, JobSearchProviderError
from app.integrations.supabase.client import (
    SupabaseClients,
    ensure_guest_account,
    require_service_client,
)
from app.modules.job_search.schema import JobSearchResult

from .repository import CompanyRepository
from .schema import (
    CompanyJob,
    CompanyJobsResponse,
    CompanyProfileResponse,
    SavedCompanyResponse,
)

_ID_PREFIX = "co_"
_SEARCH_PAGE_SIZE = 20
_CACHE_TTL_SECONDS = 60 * 60
_MAX_TECH_STACK = 8

# Technologies recognised in posting titles, descriptions and skill lists.
_TECH_VOCABULARY = [
    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "React",
    "React Native",
    "Angular",
    "Vue",
    "Node.js",
    "Go",
    "Kotlin",
    "Swift",
    "C#",
    ".NET",
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "SQL",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Kafka",
    "Spark",
    "Django",
    "Flask",
    "FastAPI",
    "Spring",
    "Terraform",
]
_TECH_PATTERNS = {
    tech: re.compile(rf"(?<![A-Za-z0-9+#.]){re.escape(tech)}(?![A-Za-z0-9+#])", re.IGNORECASE)
    for tech in _TECH_VOCABULARY
}

_cache: dict[tuple[str, str], tuple[float, list[JobSearchResult]]] = {}
_cache_lock = threading.Lock()


def clear_cache() -> None:
    """Drop cached posting searches (used by tests)."""
    with _cache_lock:
        _cache.clear()


class CompanyNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Company not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class SavedCompanyNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Saved company not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class CompanySearchError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="company_search_error",
            message="Company search could not be completed. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class CompanyService:
    def __init__(self, clients: SupabaseClients, job_search: JobSearchProvider) -> None:
        service_client = require_service_client(clients)
        self._clients = clients
        self._job_search = job_search
        self._repository = CompanyRepository(service_client)

    def search_companies(
        self,
        actor: CurrentActor,
        *,
        query: str,
        location: str | None = None,
    ) -> list[CompanyProfileResponse]:
        needle = _normalise(query)
        if not needle:
            return []
        postings = self._postings(query.strip(), location)
        by_company: dict[str, list[JobSearchResult]] = {}
        for posting in postings:
            key = _normalise(posting.company)
            if key and needle in key:
                by_company.setdefault(key, []).append(posting)
        profiles = [_to_profile(group) for group in by_company.values()]
        return sorted(profiles, key=lambda p: p.recent_job_count or 0, reverse=True)

    def get_company(
        self,
        actor: CurrentActor,
        *,
        company_id: str,
    ) -> CompanyProfileResponse:
        group = self._company_postings(company_id)
        return _to_profile(group)

    def get_company_jobs(
        self,
        actor: CurrentActor,
        *,
        company_id: str,
    ) -> CompanyJobsResponse:
        group = self._company_postings(company_id)
        jobs = [
            CompanyJob(
                id=posting.id,
                title=posting.title,
                location=posting.location,
                url=posting.url,
                posted_date=posting.posted_date,
            )
            for posting in group
            if posting.url
        ]
        return CompanyJobsResponse(company_name=_display_name(group), jobs=jobs, total=len(jobs))

    def save_company(
        self,
        actor: CurrentActor,
        *,
        company_name: str,
        notes: str | None = None,
    ) -> SavedCompanyResponse:
        if actor.kind == "guest":
            ensure_guest_account(self._clients, actor.id)
        row = self._repository.save_company(
            actor=actor,
            company_name=company_name,
            notes=notes,
        )
        return _to_saved_response(row)

    def list_saved_companies(
        self,
        actor: CurrentActor,
    ) -> list[SavedCompanyResponse]:
        rows = self._repository.list_saved_companies(actor=actor)
        return [_to_saved_response(row) for row in rows]

    def delete_saved_company(
        self,
        actor: CurrentActor,
        *,
        saved_id: str,
    ) -> None:
        self._repository.delete_saved_company(actor=actor, saved_id=saved_id)

    # -- helpers ---------------------------------------------------------

    def _company_postings(self, company_id: str) -> list[JobSearchResult]:
        name = _decode_company_id(company_id)
        if name is None:
            raise CompanyNotFoundError()
        key = _normalise(name)
        group = [p for p in self._postings(name, None) if _normalise(p.company) == key]
        if not group:
            raise CompanyNotFoundError()
        return group

    def _postings(self, query: str, location: str | None) -> list[JobSearchResult]:
        cache_key = (_normalise(query), _normalise(location or ""))
        now = time.monotonic()
        with _cache_lock:
            hit = _cache.get(cache_key)
            if hit is not None and now - hit[0] < _CACHE_TTL_SECONDS:
                return hit[1]
        try:
            results = self._job_search.search(query, location, None, 1, _SEARCH_PAGE_SIZE)
        except JobSearchProviderError as exc:
            raise CompanySearchError() from exc
        with _cache_lock:
            _cache[cache_key] = (time.monotonic(), results)
        return results


def _normalise(value: str) -> str:
    return " ".join(value.casefold().split())


def _encode_company_id(name: str) -> str:
    token = base64.urlsafe_b64encode(name.encode("utf-8")).decode("ascii").rstrip("=")
    return f"{_ID_PREFIX}{token}"


def _decode_company_id(company_id: str) -> str | None:
    if not company_id.startswith(_ID_PREFIX):
        return None
    token = company_id[len(_ID_PREFIX) :]
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
        name = raw.decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return None
    return name or None


def _display_name(group: list[JobSearchResult]) -> str:
    return Counter(p.company for p in group).most_common(1)[0][0]


def _to_profile(group: list[JobSearchResult]) -> CompanyProfileResponse:
    name = _display_name(group)
    locations = Counter(p.location for p in group if p.location)
    return CompanyProfileResponse(
        id=_encode_company_id(name),
        name=name,
        location=locations.most_common(1)[0][0] if locations else None,
        tech_stack=_tech_stack(group),
        recent_job_count=len(group),
    )


def _tech_stack(group: list[JobSearchResult]) -> list[str]:
    counts: Counter[str] = Counter()
    for posting in group:
        text = f"{posting.title} {posting.description}"
        mentioned = {tech for tech, pattern in _TECH_PATTERNS.items() if pattern.search(text)}
        mentioned.update(skill for skill in posting.skills if skill in _TECH_PATTERNS)
        counts.update(mentioned)
    return [tech for tech, _ in counts.most_common(_MAX_TECH_STACK)]


def _to_saved_response(row: dict) -> SavedCompanyResponse:
    return SavedCompanyResponse(
        id=row["id"],
        user_id=row.get("user_id") or row.get("guest_id") or "",
        company_name=row["company_name"],
        notes=row.get("notes"),
        saved_at=row.get("saved_at") or row.get("created_at") or "",
    )
