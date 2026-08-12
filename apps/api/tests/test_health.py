"""Health endpoint tests."""

from __future__ import annotations

from app import __version__
from app.core.config import Settings
from app.main import API_V1_PREFIX, create_app
from fastapi.testclient import TestClient


def test_health_ok() -> None:
    settings = Settings(environment="dev")
    client = TestClient(create_app(settings))

    response = client.get(f"{API_V1_PREFIX}/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["environment"] == "dev"


def test_root_health_ok() -> None:
    client = TestClient(create_app(Settings()))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_route_returns_404() -> None:
    client = TestClient(create_app(Settings()))

    response = client.get("/api/v1/nope")

    assert response.status_code == 404


def test_cors_origin_allowed() -> None:
    settings = Settings(cors_origins=["http://localhost:8081"])
    client = TestClient(create_app(settings))

    response = client.options(
        f"{API_V1_PREFIX}/health",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"


def test_cors_origin_denied() -> None:
    settings = Settings(cors_origins=["http://localhost:8081"])
    client = TestClient(create_app(settings))

    response = client.options(
        f"{API_V1_PREFIX}/health",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
