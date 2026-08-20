"""Roast and interview adapter fixture tests (no live API calls)."""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest
from app.ai.gemini import GeminiProvider
from app.ai.provider import ProviderError
from app.ai.schemas import ResumeContent

MODEL = "gemini-3.6-flash"
API_KEY = "test-key"


def _provider(
    handler: Callable[[httpx.Request], httpx.Response],
) -> tuple[GeminiProvider, list[httpx.Request]]:
    captured: list[httpx.Request] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    provider = GeminiProvider(
        api_key=API_KEY,
        model=MODEL,
        transport=httpx.MockTransport(_handler),
    )
    return provider, captured


def _ok_payload(raw: str) -> dict:
    return {
        "candidates": [
            {"content": {"parts": [{"text": raw}]}, "finishReason": "STOP"}
        ],
        "modelVersion": "gemini-3.6-flash",
    }


CONTENT = ResumeContent(
    contact={"full_name": "Ada Lovelace", "email": "ada@example.com"},
    summary="Mathematician and first programmer.",
    skills=["Python", "SQL"],
)


def test_roast_resume_success() -> None:
    provider, captured = _provider(
        lambda _request: httpx.Response(
            200,
            json=_ok_payload(
                json.dumps(
                    {
                        "tone": "friendly_mentor",
                        "sections": [
                            {"title": "Summary", "content": "Understated opening."}
                        ],
                        "improvements": [
                            "Quantify at least one achievement.",
                            "Lead with the strongest skill.",
                        ],
                    }
                )
            ),
        )
    )

    result = provider.roast_resume(CONTENT, mode="friendly_mentor")

    assert result.content.improvements[0] == "Quantify at least one achievement."
    assert "roast" in captured[0].content.decode().lower()
    assert "friendly_mentor" in captured[0].content.decode()


def test_roast_resume_malformed_output_raises() -> None:
    provider, _ = _provider(
        lambda _request: httpx.Response(200, json=_ok_payload('{"tone": 42}'))
    )

    with pytest.raises(ProviderError):
        provider.roast_resume(CONTENT, mode="brutal_hr")


def test_generate_interview_questions_success() -> None:
    provider, captured = _provider(
        lambda _request: httpx.Response(
            200,
            json=_ok_payload(
                json.dumps(
                    {
                        "questions": [
                            {
                                "id": "q-1",
                                "question": "Describe a project with measurable impact.",
                                "focus": "impact",
                            }
                        ]
                    }
                )
            ),
        )
    )

    result = provider.generate_interview_questions(
        CONTENT, mode="technical", target_job="Senior Engineer", target_skills=["Python"]
    )

    assert result.content.questions[0].focus == "impact"
    body = captured[0].content.decode()
    assert "technical" in body
    assert "Senior Engineer" in body
    assert "Python" in body


def test_generate_interview_questions_without_resume() -> None:
    provider, _ = _provider(
        lambda _request: httpx.Response(
            200,
            json=_ok_payload(json.dumps({"questions": []})),
        )
    )

    result = provider.generate_interview_questions(
        None, mode="hr", target_job=None, target_skills=[]
    )

    assert result.content.questions == []


def test_evaluate_interview_answer_success() -> None:
    provider, captured = _provider(
        lambda _request: httpx.Response(
            200,
            json=_ok_payload(
                json.dumps(
                    {
                        "relevance": 85,
                        "clarity": 80,
                        "structure": 75,
                        "technical_correctness": 70,
                        "completeness": 65,
                        "feedback": "Add the measurable outcome.",
                        "suggested_answer": "I reduced startup time by 40%.",
                    }
                )
            ),
        )
    )

    result = provider.evaluate_interview_answer(
        "What did you ship?", "I led a project.", resume_context=CONTENT.summary
    )

    assert result.content.relevance == 85
    assert result.content.feedback == "Add the measurable outcome."
    assert "What did you ship?" in captured[0].content.decode()


def test_evaluate_interview_answer_malformed_output_raises() -> None:
    provider, _ = _provider(
        lambda _request: httpx.Response(200, json=_ok_payload("[]"))
    )

    with pytest.raises(ProviderError):
        provider.evaluate_interview_answer("Q", "A", resume_context=None)
