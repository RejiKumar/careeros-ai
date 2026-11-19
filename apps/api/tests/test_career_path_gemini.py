"""Career path adapter fixture tests (no live API calls)."""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest
from app.ai.gemini import GeminiProvider
from app.ai.provider import ProviderError
from app.ai.schemas import ResumeContent

MODEL = "gemini-3.6-flash"

CONTENT = ResumeContent(
    contact={"full_name": "Ada Lovelace"},
    summary="Mathematician and first programmer.",
    skills=["Python", "SQL"],
)

PATH = {
    "current_stage": "Mathematician",
    "stages": [
        {
            "title": "Mathematician",
            "description": "Current role.",
            "typical_years": 3,
            "required_skills": ["Python"],
            "recommended_actions": ["Publish"],
        }
    ],
    "gap_analysis": ["No management evidence."],
    "timeline_estimate": "4-6 years",
}


def _provider(
    handler: Callable[[httpx.Request], httpx.Response],
) -> tuple[GeminiProvider, list[httpx.Request]]:
    captured: list[httpx.Request] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    provider = GeminiProvider(
        api_key="test-key", model=MODEL, transport=httpx.MockTransport(_handler)
    )
    return provider, captured


def _ok(raw: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": raw}]}, "finishReason": "STOP"}]},
    )


def test_generate_career_path_parses_the_stages() -> None:
    provider, captured = _provider(lambda _request: _ok(json.dumps(PATH)))

    result = provider.generate_career_path(CONTENT, "Tech Lead")

    assert result.content.current_stage == "Mathematician"
    assert result.content.stages[0].typical_years == 3
    assert result.content.timeline_estimate == "4-6 years"
    body = json.loads(captured[0].content)
    assert "NEVER invent" in body["system_instruction"]["parts"][0]["text"]
    user_text = body["contents"][0]["parts"][0]["text"]
    assert "Ada Lovelace" in user_text
    assert "Tech Lead" in user_text


def test_generate_career_path_without_target_role_says_so() -> None:
    provider, captured = _provider(lambda _request: _ok(json.dumps(PATH)))

    provider.generate_career_path(CONTENT, None)

    user_text = json.loads(captured[0].content)["contents"][0]["parts"][0]["text"]
    assert "not specified" in user_text


def test_generate_career_path_malformed_output_raises() -> None:
    provider, _ = _provider(lambda _request: _ok(json.dumps({"stages": "nope"})))

    with pytest.raises(ProviderError):
        provider.generate_career_path(CONTENT, None)
