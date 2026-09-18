"""Shared fakes for API tests: in-memory Supabase-like client and AI provider."""

from __future__ import annotations

import uuid

from app.ai.provider import (
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
from app.ai.schemas import (
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
from app.integrations.supabase.auth import ERROR_CODE_INVALID, AuthVerificationError
from app.integrations.supabase.client import SupabaseClients

_FIXED_NOW = "2026-08-12T00:00:00+00:00"


class FakeResponse:
    def __init__(self, data: list) -> None:
        self.data = data


class FakeQuery:
    def __init__(self, fake_table: FakeTable) -> None:
        self._fake = fake_table
        self._filters: list[tuple[str, object]] = []

    def eq(self, column: str, value: object) -> FakeQuery:
        self._filters.append((column, value))
        return self

    def in_(self, column: str, values: list) -> FakeQuery:
        self._filters.append((column, _InValues(values)))
        return self

    def order(self, column: str, desc: bool = False) -> FakeQuery:
        self._order = (column, desc)
        return self

    def range(self, start: int, end: int) -> FakeQuery:
        self._range = (start, end)
        return self

    def limit(self, count: int) -> FakeQuery:
        self._limit = count
        return self

    def execute(self) -> FakeResponse:
        rows = self._fake.rows
        for column, value in self._filters:
            rows = [row for row in rows if _matches(row.get(column), value)]
        order = getattr(self, "_order", None)
        if order:
            column, desc = order
            rows = sorted(rows, key=lambda row: row.get(column, ""), reverse=desc)
        rng = getattr(self, "_range", None)
        if rng:
            start, end = rng
            rows = rows[start : end + 1]
        return FakeResponse([dict(row) for row in rows])


class _InValues:
    def __init__(self, values: list) -> None:
        self.values = values


def _matches(actual: object, expected: object) -> bool:
    if isinstance(expected, _InValues):
        return actual in expected.values
    return actual == expected


class FakeUpdate(FakeQuery):
    def __init__(self, fake_table: FakeTable, payload: dict) -> None:
        super().__init__(fake_table)
        self._payload = payload

    def execute(self) -> FakeResponse:
        updated: list[dict] = []
        for row in self._fake.rows:
            if all(_matches(row.get(column), value) for column, value in self._filters):
                row.update(self._payload)
                row["updated_at"] = _FIXED_NOW
                updated.append(dict(row))
        return FakeResponse(updated)


class FakeDelete(FakeQuery):
    def execute(self) -> FakeResponse:
        # Collect IDs being deleted before removing them
        deleted_ids: set[str] = set()
        for row in self._fake.rows:
            if all(_matches(row.get(column), value) for column, value in self._filters):
                rid = row.get("id")
                if rid:
                    deleted_ids.add(str(rid))

        self._fake.rows[:] = [
            row
            for row in self._fake.rows
            if not all(_matches(row.get(column), value) for column, value in self._filters)
        ]

        # Cascade: if deleting from job_descriptions, remove related job_matches
        if self._fake.name == "job_descriptions" and deleted_ids:
            matches_table = self._fake._client._rows.get("job_matches", [])
            matches_table[:] = [
                m for m in matches_table if m.get("job_description_id") not in deleted_ids
            ]

        # Cascade: if deleting from coach_threads, remove related coach_messages
        if self._fake.name == "coach_threads" and deleted_ids:
            msg_table = self._fake._client._rows.get("coach_messages", [])
            msg_table[:] = [m for m in msg_table if m.get("thread_id") not in deleted_ids]

        return FakeResponse([])


class FakeTable:
    def __init__(self, name: str, fake_client: FakeServiceClient) -> None:
        self.name = name
        self._client = fake_client
        self.rows = fake_client._rows.setdefault(name, [])

    def insert(self, payload: dict) -> FakeQueryResult:
        row = dict(payload)
        row.setdefault("id", str(uuid.uuid4()))
        row.setdefault("created_at", _FIXED_NOW)
        row.setdefault("updated_at", _FIXED_NOW)
        row.setdefault("saved_at", _FIXED_NOW)
        row.setdefault("sent_at", _FIXED_NOW)
        if self.name == "resumes":
            row.setdefault("status", "draft")
            row.setdefault("current_version_id", None)
        self.rows.append(row)
        return FakeQueryResult([dict(row)])

    def select(self, *columns: str) -> FakeQuery:
        return FakeQuery(self)

    def update(self, payload: dict) -> FakeUpdate:
        return FakeUpdate(self, payload)

    def delete(self) -> FakeDelete:
        return FakeDelete(self)


class FakeQueryResult:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def execute(self) -> FakeResponse:
        return FakeResponse([dict(row) for row in self._rows])


class FakeStorageClient:
    def __init__(self) -> None:
        self.uploads: list[dict] = []

    def from_(self, bucket: str) -> FakeBucket:
        return FakeBucket(self, bucket)


class FakeBucket:
    def __init__(self, storage: FakeStorageClient, bucket: str) -> None:
        self._storage = storage
        self._bucket = bucket

    def upload(self, path: str, content: bytes, file_options: dict | None = None) -> dict:
        self._storage.uploads.append(
            {"bucket": self._bucket, "path": path, "content": content, "options": file_options}
        )
        return {"Key": path}

    def create_signed_url(self, path: str, expires_in: int) -> dict:
        return {"signedURL": f"https://storage.test/signed/{path}?expires={expires_in}"}


class FakeServiceClient:
    def __init__(self) -> None:
        self._rows: dict[str, list[dict]] = {}
        self.storage = FakeStorageClient()

    def table(self, name: str) -> FakeTable:
        return FakeTable(name, self)


class FakeClients(SupabaseClients):
    def __init__(self) -> None:
        self.anon_client = None  # type: ignore[assignment]
        self.service_client: FakeServiceClient = FakeServiceClient()

    def verify_jwt(self, access_token: str) -> dict:
        if access_token == "good-token":
            return {"sub": "u-1", "email": "user@example.com", "role": "authenticated"}
        raise AuthVerificationError(ERROR_CODE_INVALID, "Access token is invalid.")


def sample_resume_content() -> ResumeContent:
    return ResumeContent(
        contact={"full_name": "Ada Lovelace", "email": "ada@example.com"},
        summary="Mathematician and first programmer.",
        skills=["Python", "SQL"],
        experience=[
            {
                "organization": "Analytical Engine",
                "title": "Author",
                "bullets": ["Wrote the first algorithm."],
            }
        ],
    )


class FakeProvider(CareerAiProvider):
    def __init__(
        self,
        parsed: ParsedResume | None = None,
        assessment: AssessmentResult | None = None,
        error: ProviderError | None = None,
    ) -> None:
        self._parsed = parsed
        self._assessment = assessment
        self._error = error
        self.calls: list[str] = []
        self.assess_calls: list[tuple[ResumeContent, str]] = []
        self.match_calls: list[tuple[ResumeContent, str, str]] = []
        self.rewrite_calls: list[tuple[ResumeContent, str]] = []
        self.coach_calls: list[tuple[list[CoachMessage], str | None, str]] = []
        self._match: MatchResult | None = None

    def parse_resume(self, text: str) -> ParsedResume:
        self.calls.append(text)
        if self._error is not None:
            raise self._error
        if self._parsed is not None:
            return self._parsed
        return ParsedResume(
            content=sample_resume_content(),
            request_id="request-1",
            model_version="gemini-3.6-flash",
        )

    def assess_resume(self, content: ResumeContent, *, locale: str = "en") -> AssessmentResult:
        self.assess_calls.append((content, locale))
        if self._error is not None:
            raise self._error
        if self._assessment is not None:
            return self._assessment
        return AssessmentResult(
            content=ResumeAssessment(
                scores=[
                    {
                        "dimension": "impact",
                        "score": 72,
                        "explanation": "Bullets describe actions but lack measurable outcomes.",
                    },
                    {
                        "dimension": "clarity",
                        "score": 88,
                        "explanation": "Clear structure and consistent section headers.",
                    },
                ],
                strengths=["Clear contact details and summary."],
                gaps=[
                    {
                        "description": "No measurable outcomes in work experience.",
                        "suggestion": "Add quantified results to at least one bullet.",
                    }
                ],
                evidence=["Wrote the first algorithm."],
            ),
            request_id="assess-request-1",
            model_version="gemini-3.6-flash",
        )

    def match_resume(
        self, content: ResumeContent, job_description: str, *, locale: str = "en"
    ) -> MatchResult:
        self.match_calls.append((content, job_description, locale))
        if self._error is not None:
            raise self._error
        if self._match is not None:
            return self._match
        return MatchResult(
            content=JobMatchContent(
                score=65,
                matched_skills=["Python"],
                missing_skills=["Go", "Kubernetes"],
                strengths=["Clear summary and structured work history."],
                actions=[
                    {
                        "title": "Add Go projects",
                        "detail": "The job requires Go but the resume does not show it.",
                    }
                ],
            ),
            request_id="match-request-1",
            model_version="gemini-3.6-flash",
        )

    def suggest_rewrites(self, content: ResumeContent, *, locale: str = "en") -> RewriteResult:
        self.rewrite_calls.append((content, locale))
        if self._error is not None:
            raise self._error
        return RewriteResult(
            content=RewriteContent(
                suggestions=[
                    {
                        "id": "rw-1",
                        "section": "summary",
                        "original": "Mathematician and first programmer.",
                        "rewritten": "Mathematician and author of the first published algorithm.",
                        "rationale": "More specific and results-focused, keeping the facts.",
                    }
                ]
            ),
            request_id="rewrite-request-1",
            model_version="gemini-3.6-flash",
        )

    def coach_reply(
        self,
        messages: list[CoachMessage],
        resume_context: str | None,
        *,
        locale: str = "en",
    ) -> CoachResult:
        self.coach_calls.append((messages, resume_context, locale))
        if self._error is not None:
            raise self._error
        return CoachResult(
            content=CoachReply(
                content="Focus on concrete achievements with measurable outcomes in your bullets."
            ),
            request_id="coach-request-1",
            model_version="gemini-3.6-flash",
        )

    def roast_resume(
        self, content: ResumeContent, mode: RoastMode, *, locale: str = "en"
    ) -> RoastResult:
        if self._error is not None:
            raise self._error
        return RoastResult(
            content=RoastContent(
                tone=mode,
                sections=[
                    {
                        "title": "Summary",
                        "content": "The summary lists facts but never sells the outcome.",
                    }
                ],
                improvements=[
                    "Quantify at least one achievement in the summary.",
                    "Move the strongest skill into the first bullet.",
                ],
            ),
            request_id="roast-request-1",
            model_version="gemini-3.6-flash",
        )

    def generate_interview_questions(
        self,
        content: ResumeContent | None,
        mode: str,
        target_job: str | None,
        target_skills: list[str],
        *,
        locale: str = "en",
    ) -> InterviewQuestionsResult:
        if self._error is not None:
            raise self._error
        return InterviewQuestionsResult(
            content=InterviewQuestionsContent(
                questions=[
                    {
                        "id": "q-1",
                        "question": (
                            "Walk me through a project where you shipped measurable impact."
                        ),
                        "focus": "impact",
                    }
                ]
            ),
            request_id="interview-request-1",
            model_version="gemini-3.6-flash",
        )

    def evaluate_interview_answer(
        self,
        question: str,
        answer: str,
        resume_context: str | None,
        *,
        locale: str = "en",
    ) -> AnswerEvaluationResult:
        if self._error is not None:
            raise self._error
        return AnswerEvaluationResult(
            content=AnswerEvaluation(
                relevance=85,
                clarity=80,
                structure=75,
                technical_correctness=70,
                completeness=65,
                feedback="Strong example; add the measurable outcome explicitly.",
                suggested_answer="I led a project that reduced startup time by 40%.",
            ),
            request_id="evaluation-request-1",
            model_version="gemini-3.6-flash",
        )

    def analyze_skills_gap(
        self,
        resume_content: ResumeContent,
        job_description: str,
        *,
        locale: str = "en",
    ) -> GapAnalysisResult:
        if self._error is not None:
            raise self._error
        return GapAnalysisResult(
            content=GapAnalysisContent(
                matched_skills=[{"skill": "Python", "proficiency": "strong"}],
                partial_skills=[{"skill": "AWS", "proficiency": "basic"}],
                missing_skills=[{"skill": "Kubernetes", "priority": "high"}],
                overall_match_percent=65,
                summary="Resume covers core skills but misses containerization.",
            ),
            request_id="gap-request-1",
            model_version="gemini-3.6-flash",
        )

    def tailor_resume(
        self,
        content: ResumeContent,
        job_description: str,
        *,
        locale: str = "en",
    ) -> TailorResult:
        if self._error is not None:
            raise self._error
        return TailorResult(
            content=TailorContent(
                tailored_content=content,
                changes=[
                    {"field": "summary", "type": "rewrite", "reason": "Align with job keywords"}
                ],
                match_score_improvement=12,
            ),
            request_id="tailor-request-1",
            model_version="gemini-3.6-flash",
        )

    def generate_salary_analysis(
        self,
        *,
        role: str,
        location: str,
        experience_years: int | None = None,
        skills: list[str] | None = None,
        company: str | None = None,
    ) -> SalaryAnalysisResult:
        if self._error is not None:
            raise self._error
        return SalaryAnalysisResult(
            content=SalaryAnalysisContent(
                salary_range={
                    "min_salary": 600000.0,
                    "max_salary": 1400000.0,
                    "median_salary": 950000.0,
                    "currency": "INR",
                    "experience_level": "mid",
                    "confidence": 0.7,
                },
                script={
                    "opening": "Based on market data for this role in this location...",
                    "justification_points": ["Highlight relevant experience and current skills."],
                    "handling_objections": [
                        "If the range is lower than expectations, ask for the band.",
                    ],
                    "closing": "Confirm next steps and reiterate interest.",
                },
            ),
            request_id="salary-request-1",
            model_version="gemini-3.6-flash",
        )
