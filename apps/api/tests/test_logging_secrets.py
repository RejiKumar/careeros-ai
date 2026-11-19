"""Request URLs from HTTP clients must never reach the logs (provider keys)."""

from __future__ import annotations

import logging

import httpx
from app.core.logging import configure_logging


def test_httpx_request_urls_are_not_logged(capfd: object) -> None:
    configure_logging("INFO")
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={}))

    with httpx.Client(transport=transport) as client:
        client.get("https://api.example.test/search", params={"app_key": "SECRET-VALUE"})

    assert logging.getLogger("httpx").level == logging.WARNING
    assert "SECRET-VALUE" not in capfd.readouterr().out  # type: ignore[attr-defined]
