"""Locale handling for the public API.

The mobile app sends its selected locale on AI requests via ``Accept-Language``.
Only locales in ``SUPPORTED_LOCALES`` are honoured; anything else (or nothing)
resolves to the default locale so the API contract stays stable.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Header

SUPPORTED_LOCALES = ("en",)
DEFAULT_LOCALE = "en"


def normalize_locale(raw: str) -> str:
    """Map a raw locale tag (e.g. ``en-US, en;q=0.9``) to a supported locale."""
    if not raw:
        return DEFAULT_LOCALE
    first = raw.split(",")[0].strip()
    primary = first.split("-")[0].strip().lower()
    return primary if primary in SUPPORTED_LOCALES else DEFAULT_LOCALE


def get_request_locale(
    accept_language: Annotated[str | None, Header()] = None,
) -> str:
    """FastAPI dependency: the normalized locale for an incoming request."""
    return normalize_locale(accept_language or DEFAULT_LOCALE)
