"""Gemini adapter fixture tests: deterministic request/response behavior.

Uses httpx.MockTransport so no live API call is made; the fixtures pin the
adapter contract: URL shape, prompt delimiters, structured output and the
validation of untrusted model output.
"""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest
from app.ai.gemini import GeminiProvider
from app.ai.provider import ProviderError
from app.ai.schemas import CoachMessage, ResumeContent

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
        "candidates": [{"content": {"parts": [{"text": raw}]}, "finishReason": "STOP"}],
        "modelVersion": "gemini-3.6-flash",
    }


def test_parse_resume_success() -> None:
    raw = json.dumps(
        {
            "contact": {"full_name": "Ada Lovelace", "email": "ada@example.com"},
            "summary": "First programmer.",
            "skills": ["Python"],
        }
    )
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload(raw)))

    parsed = provider.parse_resume("Some resume text")

    assert parsed.content.contact.full_name == "Ada Lovelace"
    assert parsed.content.skills == ["Python"]
    assert parsed.request_id
    assert parsed.model_version == MODEL


def test_request_contract_is_pinned() -> None:
    provider, captured = _provider(lambda request: httpx.Response(200, json=_ok_payload("{}")))

    provider.parse_resume("UNTRUSTED-RESUME-CONTENT")

    request = captured[0]
    assert request.method == "POST"
    assert request.url.path.endswith(f"/models/{MODEL}:generateContent")
    assert request.url.params["key"] == API_KEY
    body = json.loads(request.content)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    user_parts = body["contents"][0]["parts"][0]["text"]
    assert "<resume>" in user_parts and "UNTRUSTED-RESUME-CONTENT" in user_parts
    assert "fabricate" in body["system_instruction"]["parts"][0]["text"]


def test_http_error_becomes_provider_error() -> None:
    provider, _ = _provider(lambda request: httpx.Response(500, json={"error": "boom"}))

    with pytest.raises(ProviderError):
        provider.parse_resume("text")


def test_transport_error_becomes_provider_error() -> None:
    provider, _ = _provider(lambda request: (_ for _ in ()).throw(httpx.ConnectError("offline")))

    with pytest.raises(ProviderError):
        provider.parse_resume("text")


def test_missing_candidates_becomes_provider_error() -> None:
    provider, _ = _provider(lambda request: httpx.Response(200, json={"modelVersion": MODEL}))

    with pytest.raises(ProviderError):
        provider.parse_resume("text")


def test_non_json_text_becomes_provider_error() -> None:
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload("not json")))

    with pytest.raises(ProviderError):
        provider.parse_resume("text")


def test_schema_invalid_output_becomes_provider_error() -> None:
    raw = json.dumps({"skills": "should-be-a-list"})
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload(raw)))

    with pytest.raises(ProviderError):
        provider.parse_resume("text")


def test_long_resume_is_truncated() -> None:
    huge = "x" * 250_000
    provider, captured = _provider(lambda request: httpx.Response(200, json=_ok_payload("{}")))

    provider.parse_resume(huge)

    body = json.loads(captured[0].content)
    sent = body["contents"][0]["parts"][0]["text"]
    assert len(sent) < 150_000


def _assessment_raw() -> str:
    return json.dumps(
        {
            "scores": [{"dimension": "impact", "score": 72, "explanation": "Weak outcomes."}],
            "strengths": ["Clear contact details."],
            "gaps": [{"description": "No metrics.", "suggestion": "Quantify results."}],
            "evidence": ["Wrote the first algorithm."],
        }
    )


def test_assess_resume_success() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_assessment_raw()))  # noqa: E731
    provider, _ = _provider(ok)

    result = provider.assess_resume(ResumeContent(contact={"full_name": "Ada Lovelace"}))

    assert result.content.scores[0].dimension == "impact"
    assert result.content.scores[0].score == 72
    assert result.content.gaps[0].suggestion == "Quantify results."
    assert result.request_id
    assert result.model_version == MODEL


def test_assess_request_pins_prompt_contract() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_assessment_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.assess_resume(ResumeContent(skills=["Python"]))

    body = json.loads(captured[0].content)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert "fabricate" in body["system_instruction"]["parts"][0]["text"]
    user_text = body["contents"][0]["parts"][0]["text"]
    assert "<resume_content>" in user_text
    assert '"Python"' in user_text


def test_assess_invalid_output_becomes_provider_error() -> None:
    raw = json.dumps({"scores": "not-a-list"})
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload(raw)))

    with pytest.raises(ProviderError):
        provider.assess_resume(ResumeContent())


def test_assess_english_locale_adds_no_language_instruction() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_assessment_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.assess_resume(ResumeContent(skills=["Python"]), locale="en")

    system_text = json.loads(captured[0].content)["system_instruction"]["parts"][0]["text"]
    assert "locale 'en'" not in system_text


def test_assess_foreign_locale_adds_language_instruction_but_same_schema() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_assessment_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.assess_resume(ResumeContent(skills=["Python"]), locale="es")

    body = json.loads(captured[0].content)
    system_text = body["system_instruction"]["parts"][0]["text"]
    assert "locale 'es'" in system_text
    assert "do not translate" in system_text.lower()
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert "responseSchema" in body["generationConfig"]


def test_coach_foreign_locale_replies_in_requested_language() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_coach_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.coach_reply(
        [CoachMessage(role="user", content="¿Cómo mejoro mi perfil?")],
        resume_context=None,
        locale="es",
    )

    system_text = json.loads(captured[0].content)["system_instruction"]["parts"][0]["text"]
    assert "locale 'es'" in system_text


def _match_raw() -> str:
    return json.dumps(
        {
            "score": 65,
            "matched_skills": ["Python"],
            "missing_skills": ["Go"],
            "strengths": ["Clear summary."],
            "actions": [{"title": "Add Go", "detail": "Job requires Go."}],
        }
    )


def test_match_resume_success() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_match_raw()))  # noqa: E731
    provider, _ = _provider(ok)

    result = provider.match_resume(ResumeContent(skills=["Python"]), "Job requires Go and Python.")

    assert result.content.score == 65
    assert result.content.matched_skills == ["Python"]
    assert result.content.missing_skills == ["Go"]
    assert result.content.actions[0].title == "Add Go"
    assert result.model_version == MODEL


def test_match_request_pins_prompt_contract() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_match_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.match_resume(ResumeContent(skills=["Python"]), "UNTRUSTED-JD-CONTENT")

    body = json.loads(captured[0].content)
    assert "fabricate" in body["system_instruction"]["parts"][0]["text"]
    user_text = body["contents"][0]["parts"][0]["text"]
    assert "<job_description>" in user_text and "UNTRUSTED-JD-CONTENT" in user_text
    assert "<resume_content>" in user_text


def test_match_invalid_output_becomes_provider_error() -> None:
    raw = json.dumps({"score": "not-a-number"})
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload(raw)))

    with pytest.raises(ProviderError):
        provider.match_resume(ResumeContent(), "Job description.")


def _rewrite_raw() -> str:
    return json.dumps(
        {
            "suggestions": [
                {
                    "id": "rw-1",
                    "section": "summary",
                    "original": "Mathematician and first programmer.",
                    "rewritten": "Mathematician and author of the first published algorithm.",
                    "rationale": "More specific, facts preserved.",
                }
            ]
        }
    )


def test_suggest_rewrites_success() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_rewrite_raw()))  # noqa: E731
    provider, _ = _provider(ok)

    result = provider.suggest_rewrites(ResumeContent(summary="Mathematician and first programmer."))

    assert result.content.suggestions[0].id == "rw-1"
    assert result.content.suggestions[0].section == "summary"
    assert result.content.suggestions[0].rewritten.startswith("Mathematician and author")
    assert result.model_version == MODEL


def test_suggest_rewrites_pins_no_fabrication_prompt() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_rewrite_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.suggest_rewrites(ResumeContent(summary="Mathematician."))

    body = json.loads(captured[0].content)
    system_text = body["system_instruction"]["parts"][0]["text"]
    assert "invent" in system_text
    assert "NEVER add" in system_text
    assert "<resume_content>" in body["contents"][0]["parts"][0]["text"]


def test_suggest_rewrites_invalid_output_becomes_provider_error() -> None:
    raw = json.dumps({"suggestions": "not-a-list"})
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload(raw)))

    with pytest.raises(ProviderError):
        provider.suggest_rewrites(ResumeContent())


def _coach_raw() -> str:
    return json.dumps({"content": "Focus on concrete, measurable achievements in your bullets."})


def test_coach_reply_success() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_coach_raw()))  # noqa: E731
    provider, _ = _provider(ok)

    result = provider.coach_reply(
        [CoachMessage(role="user", content="How do I improve my bullets?")],
        resume_context=json.dumps({"summary": "Mathematician."}),
    )

    assert result.content.content.startswith("Focus on concrete")
    assert result.request_id
    assert result.model_version == MODEL
    assert result.model_version == MODEL


def test_coach_request_pins_prompt_contract() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_coach_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.coach_reply(
        [
            CoachMessage(role="user", content="UNTRUSTED-QUESTION"),
            CoachMessage(role="assistant", content="Earlier reply."),
        ],
        resume_context="<resume text>",
    )

    body = json.loads(captured[0].content)
    system_text = body["system_instruction"]["parts"][0]["text"]
    assert "Never invent facts" in system_text
    assert "do not know" in system_text
    user_text = body["contents"][0]["parts"][0]["text"]
    assert "UNTRUSTED-QUESTION" in user_text
    assert "Earlier reply." in user_text
    assert "<history>" in user_text
    assert "<resume_context>" in user_text and "<resume text>" in user_text


def test_coach_reply_without_resume_context_is_explicit() -> None:
    ok = lambda request: httpx.Response(200, json=_ok_payload(_coach_raw()))  # noqa: E731
    provider, captured = _provider(ok)

    provider.coach_reply([CoachMessage(role="user", content="Plan my week.")], resume_context=None)

    user_text = json.loads(captured[0].content)["contents"][0]["parts"][0]["text"]
    assert "(none provided)" in user_text


def test_coach_invalid_output_becomes_provider_error() -> None:
    raw = json.dumps({"content": 123})
    provider, _ = _provider(lambda request: httpx.Response(200, json=_ok_payload(raw)))

    with pytest.raises(ProviderError):
        provider.coach_reply([CoachMessage(role="user", content="Hi")], resume_context=None)
