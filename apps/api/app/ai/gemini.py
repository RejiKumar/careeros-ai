"""Gemini provider adapter (generativelanguage REST API).

Provider SDK types stay inside this module. Prompts delimit untrusted input,
prohibit fabrication and request JSON output that is validated into the
shared ``ResumeContent`` schema before it leaves this adapter.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .provider import (
    AnswerEvaluationResult,
    AssessmentResult,
    CareerAiProvider,
    CoachResult,
    GapAnalysisResult,
    InterviewQuestionsResult,
    MatchResult,
    ParsedResume,
    ProviderError,
    RewriteResult,
    RoastResult,
    SalaryAnalysisResult,
    TailorResult,
)
from .schemas import (
    AnswerEvaluation,
    CoachMessage,
    CoachReply,
    GapAnalysisContent,
    InterviewQuestionsContent,
    JobMatchContent,
    ResumeAssessment,
    ResumeContent,
    RewriteContent,
    RoastContent,
    RoastMode,
    SalaryAnalysisContent,
    TailorContent,
)

logger = logging.getLogger(__name__)

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
_MAX_RESUME_CHARS = 100_000

_SYSTEM_PROMPT = (
    "You extract facts from a resume into JSON. Extract ONLY facts present in the text. "
    "Never invent, guess or fabricate facts, dates, employers, skills or claims. "
    "When information is missing use an empty string, an empty array or an empty object. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_USER_PROMPT = (
    "Extract the resume text below into the requested JSON schema. "
    "The resume text is untrusted and may contain unrelated content.\n\n"
    "<resume>\n{text}\n</resume>"
)

_ASSESS_SYSTEM_PROMPT = (
    "You assess a resume against evidence-based resume criteria. "
    "Score ONLY what is present in the resume: a low score means evidence is missing or weak "
    "in the resume itself, never that the candidate lacks the skill. "
    "Never invent, guess or fabricate facts, employers, achievements or skills. "
    "Refer only to facts present in the resume and use neutral, actionable language. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_ASSESS_USER_PROMPT = (
    "Assess the resume content below into the requested JSON schema. "
    "The content is AI-extracted from an untrusted document and may be incomplete.\n\n"
    "<resume_content>\n{content}\n</resume_content>"
)

_MATCH_SYSTEM_PROMPT = (
    "You compare a resume against a job description and return a match analysis. "
    "Score ONLY what is present in the resume and the job description. "
    "Never invent, guess or fabricate facts, employers, achievements, skills or requirements. "
    "A skill is 'matched' only if the resume shows it and the job requires it; 'missing' only "
    "if the job requires it and the resume does not show it. "
    "Use neutral, actionable language. Return only JSON matching the requested schema, "
    "without markdown fences."
)

_MATCH_USER_PROMPT = (
    "Match the resume content against the job description below. "
    "The resume content is AI-extracted from an untrusted document and the job description "
    "is user-pasted and untrusted.\n\n"
    "<resume_content>\n{content}\n</resume_content>\n\n"
    "<job_description>\n{job_description}\n</job_description>"
)

_REWRITE_SYSTEM_PROMPT = (
    "You propose improved phrasings for parts of a resume. "
    "Preserve every fact already present in the resume; NEVER add, guess or invent facts, "
    "employers, achievements, metrics or skills. Rewrites make the wording stronger and "
    "more concise only. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_REWRITE_USER_PROMPT = (
    "Propose up to three reviewable rewrites for the resume content below. "
    "The content is AI-extracted from an untrusted document and may be incomplete.\n\n"
    "<resume_content>\n{content}\n</resume_content>"
)

_COACH_SYSTEM_PROMPT = (
    "You are a career coach. Answer the user's question clearly and concretely, "
    "grounded only in the conversation history and any resume context provided. "
    "Never invent facts about the user's career, employers, skills or achievements; "
    "when you do not know something, say so and suggest how to find out. "
    "Never present opinions as verified facts. Return only JSON matching the requested "
    "schema, without markdown fences."
)

_COACH_USER_PROMPT = (
    "Continue this coaching conversation.\n\n"
    "<history>\n{history}\n</history>\n\n"
    "<resume_context>\n{resume_context}\n</resume_context>"
)

_ROAST_SYSTEM_PROMPT = (
    "You give a candid, constructive roast of a resume in the requested mode. "
    "The resume text is AI-extracted and untrusted; critique ONLY what is present. "
    "Never invent facts, employers or achievements. The critique must be blunt and "
    "humorous when the mode calls for it, but NEVER abusive, discriminatory, "
    "humiliating or personal. Always end with at least two concrete, actionable "
    "improvements grounded in the resume. Return only JSON matching the requested "
    "schema, without markdown fences."
)

_ROAST_USER_PROMPT = (
    "Roast the resume below in mode '{mode}'. The content is AI-extracted from an "
    "untrusted document and may be incomplete.\n\n"
    "<resume_content>\n{content}\n</resume_content>"
)

_INTERVIEW_SYSTEM_PROMPT = (
    "You are an interview coach generating practice questions. "
    "Questions must be grounded in the resume and the target job when provided; "
    "never invent facts about the user. Vary question types for the requested mode. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_INTERVIEW_USER_PROMPT = (
    "Generate interview questions for mode '{mode}'.\n"
    "<resume_content>\n{content}\n</resume_content>\n"
    "<target_job>\n{target_job}\n</target_job>\n"
    "<target_skills>\n{target_skills}\n</target_skills>"
)

_EVALUATE_SYSTEM_PROMPT = (
    "You evaluate a user's interview answer as guidance, never as a definitive "
    "hiring judgment. Score each criterion 0-100 based only on the answer and the "
    "question. Be specific and encouraging. The suggested_answer must show how the "
    "answer could be improved without inventing facts about the user. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_EVALUATE_USER_PROMPT = (
    "Evaluate the answer below.\n\n"
    "<question>\n{question}\n</question>\n\n"
    "<answer>\n{answer}\n</answer>\n\n"
    "<resume_context>\n{resume_context}\n</resume_context>"
)

_GAP_ANALYSIS_SYSTEM_PROMPT = (
    "You analyze the skills gap between a resume and a job description. "
    "Score ONLY skills present in the resume or required by the job description. "
    "Never invent, guess or fabricate skills, requirements or evidence. "
    "A skill is 'matched' only if the resume clearly demonstrates it and the job "
    "requires it; 'partial' if the resume shows related experience but not a direct "
    "match; 'missing' if the job requires it and the resume does not demonstrate it. "
    "For missing skills, suggest realistic learning resources. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_GAP_ANALYSIS_USER_PROMPT = (
    "Analyze the skills gap between this resume and job description.\n\n"
    "<resume_content>\n{content}\n</resume_content>\n\n"
    "<job_description>\n{job_description}\n</job_description>"
)

_TAILOR_SYSTEM_PROMPT = (
    "You tailor a resume for a specific job description. "
    "IMPORTANT: Do NOT fabricate any experience, skills or qualifications. "
    "Only rephrase, reorder and emphasize existing content. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_SALARY_SYSTEM_PROMPT = (
    "You estimate market salary ranges and draft negotiation guidance. "
    "Ground estimates ONLY in general market signals for the role, location "
    "and experience level given; never invent a single guaranteed offer. "
    "Always present figures as ranges and estimates to validate. Keep the "
    "negotiation script practical and respectful. "
    "Return only JSON matching the requested schema, without markdown fences."
)

_SALARY_USER_PROMPT = (
    "Estimate a market salary range and negotiation guidance.\n\n"
    "<role>\n{role}\n</role>\n\n"
    "<location>\n{location}\n</location>\n\n"
    "<experience_years>\n{experience_years}\n</experience_years>\n\n"
    "<skills>\n{skills}\n</skills>\n\n"
    "<company>\n{company}\n</company>"
)

_TAILOR_USER_PROMPT = (
    "Tailor this resume for the specific job description. "
    "IMPORTANT: Do NOT fabricate any experience, skills or qualifications. "
    "Only rephrase, reorder and emphasize existing content.\n\n"
    "Resume content:\n{resume_content}\n\n"
    "Job description:\n{job_description}\n\n"
    "Return a JSON object with:\n"
    "- tailored_content: the modified resume content (same structure as input)\n"
    "- diffs: list of changes made, each with field, original, tailored and reasoning\n\n"
    "Guidelines:\n"
    "1. Rewrite summary to emphasize relevant experience for this role\n"
    "2. Reorder skills to match job requirements (most relevant first)\n"
    "3. Adjust bullet points to use job-specific keywords where truthful\n"
    "4. Do NOT add skills or experience not in the original\n"
    "5. Preserve factual accuracy throughout"
)


def _language_instruction(locale: str) -> str:
    """Direct the response language for non-English locales, keeping the schema.

    Resume facts are never translated: only free-text advice, explanations and
    rationale follow the requested locale.
    """
    if locale == "en":
        return ""
    return (
        f" Write all free-text fields in the language for locale '{locale}'. "
        "Keep the JSON schema identical and do not translate names, skills, "
        "companies or other facts from the resume."
    )


class GeminiProvider(CareerAiProvider):
    """CareerAiProvider backed by the Gemini generateContent API."""

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        base_url: str = _BASE_URL,
        timeout: float = 90.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._client = httpx.Client(base_url=base_url, timeout=timeout, transport=transport)

    def parse_resume(self, text: str) -> ParsedResume:
        user_text = _USER_PROMPT.format(text=text[:_MAX_RESUME_CHARS] or " ")
        raw, request_id = self._generate(_SYSTEM_PROMPT, user_text, _resume_json_schema())
        content = _validated(ResumeContent, raw, request_id)
        return ParsedResume(content=content, request_id=request_id, model_version=self._model)

    def assess_resume(self, content: ResumeContent, *, locale: str = "en") -> AssessmentResult:
        payload = content.model_dump(mode="json")
        user_text = _ASSESS_USER_PROMPT.format(content=json.dumps(payload, ensure_ascii=False))
        system_prompt = _ASSESS_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _assessment_json_schema())
        assessment = _validated(ResumeAssessment, raw, request_id)
        return AssessmentResult(
            content=assessment,
            request_id=request_id,
            model_version=self._model,
        )

    def match_resume(
        self, content: ResumeContent, job_description: str, *, locale: str = "en"
    ) -> MatchResult:
        payload = content.model_dump(mode="json")
        user_text = _MATCH_USER_PROMPT.format(
            content=json.dumps(payload, ensure_ascii=False),
            job_description=job_description[:_MAX_RESUME_CHARS] or " ",
        )
        system_prompt = _MATCH_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _match_json_schema())
        match = _validated(JobMatchContent, raw, request_id)
        return MatchResult(content=match, request_id=request_id, model_version=self._model)

    def suggest_rewrites(self, content: ResumeContent, *, locale: str = "en") -> RewriteResult:
        payload = content.model_dump(mode="json")
        user_text = _REWRITE_USER_PROMPT.format(content=json.dumps(payload, ensure_ascii=False))
        system_prompt = _REWRITE_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _rewrite_json_schema())
        rewrites = _validated(RewriteContent, raw, request_id)
        return RewriteResult(content=rewrites, request_id=request_id, model_version=self._model)

    def coach_reply(
        self,
        messages: list[CoachMessage],
        resume_context: str | None,
        *,
        locale: str = "en",
    ) -> CoachResult:
        history_lines = [f"{m.role}: {m.content}" for m in messages]
        user_text = _COACH_USER_PROMPT.format(
            history="\n".join(history_lines) or "(no prior messages)",
            resume_context=resume_context or "(none provided)",
        )
        system_prompt = _COACH_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _coach_json_schema())
        reply = _validated(CoachReply, raw, request_id)
        logger.info("Coach reply generated (request %s, %d messages)", request_id, len(messages))
        return CoachResult(content=reply, request_id=request_id, model_version=self._model)

    def roast_resume(
        self, content: ResumeContent, mode: RoastMode, *, locale: str = "en"
    ) -> RoastResult:
        payload = content.model_dump(mode="json")
        user_text = _ROAST_USER_PROMPT.format(
            mode=mode, content=json.dumps(payload, ensure_ascii=False)
        )
        system_prompt = _ROAST_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _roast_json_schema())
        roast = _validated(RoastContent, raw, request_id)
        logger.info("Resume roast generated (request %s, mode %s)", request_id, mode)
        return RoastResult(content=roast, request_id=request_id, model_version=self._model)

    def generate_interview_questions(
        self,
        content: ResumeContent | None,
        mode: str,
        target_job: str | None,
        target_skills: list[str],
        *,
        locale: str = "en",
    ) -> InterviewQuestionsResult:
        payload = content.model_dump(mode="json") if content is not None else {}
        user_text = _INTERVIEW_USER_PROMPT.format(
            mode=mode,
            content=json.dumps(payload, ensure_ascii=False) or "(no resume provided)",
            target_job=target_job or "(not specified)",
            target_skills=", ".join(target_skills) or "(not specified)",
        )
        system_prompt = _INTERVIEW_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(
            system_prompt, user_text, _interview_questions_json_schema()
        )
        questions = _validated(InterviewQuestionsContent, raw, request_id)
        logger.info(
            "Interview questions generated (request %s, mode %s, %d questions)",
            request_id,
            mode,
            len(questions.questions),
        )
        return InterviewQuestionsResult(
            content=questions, request_id=request_id, model_version=self._model
        )

    def evaluate_interview_answer(
        self,
        question: str,
        answer: str,
        resume_context: str | None,
        *,
        locale: str = "en",
    ) -> AnswerEvaluationResult:
        user_text = _EVALUATE_USER_PROMPT.format(
            question=question,
            answer=answer,
            resume_context=resume_context or "(none provided)",
        )
        system_prompt = _EVALUATE_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _evaluation_json_schema())
        evaluation = _validated(AnswerEvaluation, raw, request_id)
        logger.info("Interview answer evaluated (request %s)", request_id)
        return AnswerEvaluationResult(
            content=evaluation, request_id=request_id, model_version=self._model
        )

    def analyze_skills_gap(
        self,
        resume_content: ResumeContent,
        job_description: str,
        *,
        locale: str = "en",
    ) -> GapAnalysisResult:
        payload = resume_content.model_dump(mode="json")
        user_text = _GAP_ANALYSIS_USER_PROMPT.format(
            content=json.dumps(payload, ensure_ascii=False),
            job_description=job_description[:_MAX_RESUME_CHARS] or " ",
        )
        system_prompt = _GAP_ANALYSIS_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _gap_analysis_json_schema())
        analysis = _validated(GapAnalysisContent, raw, request_id)
        return GapAnalysisResult(content=analysis, request_id=request_id, model_version=self._model)

    def tailor_resume(
        self,
        content: ResumeContent,
        job_description: str,
        *,
        locale: str = "en",
    ) -> TailorResult:
        payload = content.model_dump(mode="json")
        user_text = _TAILOR_USER_PROMPT.format(
            resume_content=json.dumps(payload, ensure_ascii=False),
            job_description=job_description[:_MAX_RESUME_CHARS] or " ",
        )
        system_prompt = _TAILOR_SYSTEM_PROMPT + _language_instruction(locale)
        raw, request_id = self._generate(system_prompt, user_text, _tailor_json_schema())
        tailored = _validated(TailorContent, raw, request_id)
        logger.info("Resume tailored (request %s)", request_id)
        return TailorResult(content=tailored, request_id=request_id, model_version=self._model)

    def generate_salary_analysis(
        self,
        *,
        role: str,
        location: str,
        experience_years: int | None = None,
        skills: list[str] | None = None,
        company: str | None = None,
    ) -> SalaryAnalysisResult:
        user_text = _SALARY_USER_PROMPT.format(
            role=role or "Unknown",
            location=location or "Unknown",
            experience_years="n/a" if experience_years is None else str(experience_years),
            skills=", ".join(skills) if skills else "n/a",
            company=company or "n/a",
        )
        raw, request_id = self._generate(_SALARY_SYSTEM_PROMPT, user_text, _salary_json_schema())
        analysis = _validated(SalaryAnalysisContent, raw, request_id)
        logger.info("Salary analysis generated (request %s)", request_id)
        return SalaryAnalysisResult(
            content=analysis, request_id=request_id, model_version=self._model
        )

    def _post_with_retry(self, body: dict, attempts: int = 3) -> httpx.Response:
        """POST generateContent with exponential backoff on 429 rate limits."""
        for attempt in range(attempts):
            response = self._client.post(
                f"/models/{self._model}:generateContent",
                params={"key": self._api_key},
                json=body,
            )
            if response.status_code == 429 and attempt < attempts - 1:
                wait = 2**attempt * 5.0
                logger.warning(
                    "Gemini rate limited (429), retrying in %.0fs (attempt %d/%d)",
                    wait,
                    attempt + 1,
                    attempts,
                )
                time.sleep(wait)
                continue
            response.raise_for_status()
            return response
        raise ProviderError("AI provider rate limit exceeded.")

    def _generate(
        self, system_prompt: str, user_text: str, response_schema: dict
    ) -> tuple[dict, str]:
        """Call generateContent and return the parsed JSON object plus request id."""
        request_id = uuid.uuid4().hex
        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_text}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
            },
        }

        try:
            response = self._post_with_retry(body)
            payload = response.json()
            parts = payload["candidates"][0]["content"]["parts"]
            raw = "".join(part.get("text", "") for part in parts)
            return json.loads(raw), request_id
        except httpx.HTTPStatusError as exc:
            logger.warning("Gemini HTTP %s (request %s)", exc.response.status_code, request_id)
            status_code = exc.response.status_code
            raise ProviderError(f"AI provider request failed (HTTP {status_code}).") from exc
        except httpx.HTTPError as exc:
            logger.warning("Gemini request error (request %s)", request_id)
            raise ProviderError("AI provider request failed.") from exc
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            logger.warning("Gemini malformed response (request %s)", request_id)
            raise ProviderError("AI provider returned a malformed response.") from exc


def _string_array_schema() -> dict[str, str]:
    return {"type": "array", "items": {"type": "string"}}


def _object_schema(properties: dict, required: list[str]) -> dict[str, Any]:
    # Gemini's generateContent REST API rejects `additionalProperties` in
    # responseSchema; unknown extra fields are ignored by the pydantic models
    # (ConfigDict(extra="ignore")) after validation.
    return {
        "type": "object",
        "properties": properties,
        "required": required,
    }


def _resume_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching ResumeContent (all fields required)."""
    string_array = _string_array_schema()

    return _object_schema(
        {
            "contact": _object_schema(
                {
                    "full_name": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "location": {"type": "string"},
                    "links": string_array,
                },
                ["full_name", "email", "phone", "location", "links"],
            ),
            "summary": {"type": "string"},
            "skills": string_array,
            "experience": {
                "type": "array",
                "items": _object_schema(
                    {
                        "organization": {"type": "string"},
                        "title": {"type": "string"},
                        "start_date": {"type": "string"},
                        "end_date": {"type": "string"},
                        "bullets": string_array,
                    },
                    ["organization", "title", "start_date", "end_date", "bullets"],
                ),
            },
            "education": {
                "type": "array",
                "items": _object_schema(
                    {
                        "institution": {"type": "string"},
                        "degree": {"type": "string"},
                        "field_of_study": {"type": "string"},
                        "start_date": {"type": "string"},
                        "end_date": {"type": "string"},
                    },
                    ["institution", "degree", "field_of_study", "start_date", "end_date"],
                ),
            },
            "projects": {
                "type": "array",
                "items": _object_schema(
                    {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "url": {"type": "string"},
                        "bullets": string_array,
                    },
                    ["name", "description", "url", "bullets"],
                ),
            },
            "certifications": string_array,
            "languages": string_array,
        },
        [
            "contact",
            "summary",
            "skills",
            "experience",
            "education",
            "projects",
            "certifications",
            "languages",
        ],
    )


def _assessment_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching ResumeAssessment."""
    return _object_schema(
        {
            "scores": {
                "type": "array",
                "items": _object_schema(
                    {
                        "dimension": {"type": "string"},
                        "score": {"type": "integer"},
                        "explanation": {"type": "string"},
                    },
                    ["dimension", "score", "explanation"],
                ),
            },
            "strengths": _string_array_schema(),
            "gaps": {
                "type": "array",
                "items": _object_schema(
                    {
                        "description": {"type": "string"},
                        "suggestion": {"type": "string"},
                    },
                    ["description", "suggestion"],
                ),
            },
            "evidence": _string_array_schema(),
        },
        ["scores", "strengths", "gaps", "evidence"],
    )


def _match_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching JobMatchContent."""
    return _object_schema(
        {
            "score": {"type": "integer"},
            "matched_skills": _string_array_schema(),
            "missing_skills": _string_array_schema(),
            "strengths": _string_array_schema(),
            "actions": {
                "type": "array",
                "items": _object_schema(
                    {
                        "title": {"type": "string"},
                        "detail": {"type": "string"},
                    },
                    ["title", "detail"],
                ),
            },
        },
        ["score", "matched_skills", "missing_skills", "strengths", "actions"],
    )


def _rewrite_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching RewriteContent."""
    return _object_schema(
        {
            "suggestions": {
                "type": "array",
                "items": _object_schema(
                    {
                        "id": {"type": "string"},
                        "section": {"type": "string"},
                        "original": {"type": "string"},
                        "rewritten": {"type": "string"},
                        "rationale": {"type": "string"},
                    },
                    ["id", "section", "original", "rewritten", "rationale"],
                ),
            },
        },
        ["suggestions"],
    )


def _coach_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching CoachReply."""
    return _object_schema({"content": {"type": "string"}}, ["content"])


def _roast_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching RoastContent."""
    section_schema = _object_schema(
        {
            "title": {"type": "string"},
            "content": {"type": "string"},
        },
        ["title", "content"],
    )
    return _object_schema(
        {
            "tone": {"type": "string"},
            "sections": {"type": "array", "items": section_schema},
            "improvements": _string_array_schema(),
        },
        ["tone", "sections", "improvements"],
    )


def _interview_questions_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching InterviewQuestionsContent."""
    question_schema = _object_schema(
        {
            "id": {"type": "string"},
            "question": {"type": "string"},
            "focus": {"type": "string"},
        },
        ["id", "question", "focus"],
    )
    return _object_schema(
        {"questions": {"type": "array", "items": question_schema}},
        ["questions"],
    )


def _evaluation_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching AnswerEvaluation."""
    return _object_schema(
        {
            "relevance": {"type": "integer"},
            "clarity": {"type": "integer"},
            "structure": {"type": "integer"},
            "technical_correctness": {"type": "integer"},
            "completeness": {"type": "integer"},
            "feedback": {"type": "string"},
            "suggested_answer": {"type": "string"},
        },
        [
            "relevance",
            "clarity",
            "structure",
            "technical_correctness",
            "completeness",
            "feedback",
            "suggested_answer",
        ],
    )


def _learning_resource_schema() -> dict[str, Any]:
    return _object_schema(
        {
            "title": {"type": "string"},
            "url": {"type": "string"},
            "type": {"type": "string"},
            "provider": {"type": "string"},
        },
        ["title", "type"],
    )


def _skill_gap_item_schema() -> dict[str, Any]:
    return _object_schema(
        {
            "skill": {"type": "string"},
            "status": {"type": "string"},
            "resume_evidence": {"type": "string"},
            "job_requirement": {"type": "string"},
            "confidence": {"type": "number"},
            "learning_resources": {
                "type": "array",
                "items": _learning_resource_schema(),
            },
        },
        ["skill", "status", "job_requirement", "confidence"],
    )


def _gap_analysis_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching GapAnalysisContent."""
    skill_array = {"type": "array", "items": _skill_gap_item_schema()}
    return _object_schema(
        {
            "matched_skills": skill_array,
            "partial_skills": skill_array,
            "missing_skills": skill_array,
        },
        ["matched_skills", "partial_skills", "missing_skills"],
    )


def _tailor_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching TailorContent."""
    diff_schema = _object_schema(
        {
            "field": {"type": "string"},
            "original": {"type": "string"},
            "tailored": {"type": "string"},
            "reasoning": {"type": "string"},
        },
        ["field", "original", "tailored", "reasoning"],
    )
    return _object_schema(
        {
            "tailored_content": _resume_json_schema(),
            "diffs": {"type": "array", "items": diff_schema},
        },
        ["tailored_content", "diffs"],
    )


def _salary_json_schema() -> dict[str, Any]:
    """Strict JSON schema matching SalaryAnalysisContent."""
    string_array = _string_array_schema()
    return _object_schema(
        {
            "salary_range": _object_schema(
                {
                    "min_salary": {"type": "number"},
                    "max_salary": {"type": "number"},
                    "median_salary": {"type": "number"},
                    "currency": {"type": "string"},
                    "experience_level": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                [
                    "min_salary",
                    "max_salary",
                    "median_salary",
                    "currency",
                    "experience_level",
                    "confidence",
                ],
            ),
            "script": _object_schema(
                {
                    "opening": {"type": "string"},
                    "justification_points": string_array,
                    "handling_objections": string_array,
                    "closing": {"type": "string"},
                },
                ["opening", "justification_points", "handling_objections", "closing"],
            ),
        },
        ["salary_range", "script"],
    )


def _validated(model: type[ModelT], raw: dict, request_id: str) -> ModelT:
    """Validate provider output into a schema, mapping failures to ProviderError."""
    try:
        return model.model_validate(raw)
    except ValidationError as exc:
        logger.warning("Gemini output failed schema validation (request %s)", request_id)
        raise ProviderError("AI provider output failed validation.") from exc


ModelT = TypeVar("ModelT", bound=BaseModel)
