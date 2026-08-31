"""Provider-neutral structured data schemas shared by AI features.

These types are the contract between AI providers and domain use cases.
Provider SDK types never appear here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ContactInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    links: list[str] = Field(default_factory=list)


class WorkEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    organization: str = ""
    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    institution: str = ""
    degree: str | None = None
    field_of_study: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class ProjectEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    description: str | None = None
    url: str | None = None
    bullets: list[str] = Field(default_factory=list)


class ResumeContent(BaseModel):
    """Structured resume extracted from an untrusted document.

    Only facts present in the source may be represented; missing facts are
    None or empty. Always treat instances of this model as AI-derived and
    reviewable, never as ground truth.
    """

    model_config = ConfigDict(extra="ignore")

    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: list[WorkEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class HealthDimensionScore(BaseModel):
    """A single resume health dimension scored 0-100."""

    model_config = ConfigDict(extra="ignore")

    dimension: str = ""
    score: int = 0
    explanation: str | None = None


class GapFinding(BaseModel):
    """A weakness found in a resume, with an actionable suggestion."""

    model_config = ConfigDict(extra="ignore")

    description: str = ""
    suggestion: str | None = None


class ResumeAssessment(BaseModel):
    """AI-derived resume health assessment. Reviewable, never ground truth.

    Scores only reflect facts present in the resume; a low score means
    evidence is missing or weak in the resume itself, not that the person
    lacks the skill.
    """

    model_config = ConfigDict(extra="ignore")

    scores: list[HealthDimensionScore] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    gaps: list[GapFinding] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)


class MatchAction(BaseModel):
    """An actionable suggestion to improve the resume for a specific job."""

    model_config = ConfigDict(extra="ignore")

    title: str = ""
    detail: str | None = None


class JobMatchContent(BaseModel):
    """AI-derived resume-vs-job match. Reviewable, never ground truth.

    The score and skill lists reflect only evidence present in the resume and
    job description; a low score means the resume does not demonstrate the
    required skills, not that the person lacks them.
    """

    model_config = ConfigDict(extra="ignore")

    score: int = 0
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    actions: list[MatchAction] = Field(default_factory=list)


class RewriteSuggestion(BaseModel):
    """One proposed rewrite of a resume passage. Never adds new facts."""

    model_config = ConfigDict(extra="ignore")

    id: str = ""
    section: str = ""
    original: str = ""
    rewritten: str = ""
    rationale: str | None = None


class RewriteContent(BaseModel):
    """AI-derived rewrite suggestions. Reviewable, never applied automatically."""

    model_config = ConfigDict(extra="ignore")

    suggestions: list[RewriteSuggestion] = Field(default_factory=list)


class CoachMessage(BaseModel):
    """One turn of a coach conversation fed to the provider."""

    model_config = ConfigDict(extra="ignore")

    role: Literal["user", "assistant"] = "user"
    content: str = ""


class CoachReply(BaseModel):
    """A single coach reply. Advice, never fabricated claims."""

    model_config = ConfigDict(extra="ignore")

    content: str = ""


RoastMode = Literal[
    "friendly_mentor", "professional_hr", "brutal_hr", "funny_roast", "robot_recruiter"
]


class RoastSection(BaseModel):
    """One section of a roast critique, grounded in the resume."""

    model_config = ConfigDict(extra="ignore")

    title: str = ""
    content: str = ""


class RoastContent(BaseModel):
    """AI-derived resume roast. Reviewable; always constructive.

    Every roast ends with at least two actionable improvements grounded in
    facts present in the resume. Never abusive, discriminatory or humiliating.
    """

    model_config = ConfigDict(extra="ignore")

    tone: str = ""
    sections: list[RoastSection] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)


class InterviewQuestion(BaseModel):
    """One generated interview question."""

    model_config = ConfigDict(extra="ignore")

    id: str = ""
    question: str = ""
    focus: str = ""


class InterviewQuestionsContent(BaseModel):
    """AI-derived set of interview questions for a session."""

    model_config = ConfigDict(extra="ignore")

    questions: list[InterviewQuestion] = Field(default_factory=list)


class AnswerEvaluation(BaseModel):
    """AI-derived evaluation of one interview answer. Guidance, not a hiring judgment."""

    model_config = ConfigDict(extra="ignore")

    relevance: int = 0
    clarity: int = 0
    structure: int = 0
    technical_correctness: int = 0
    completeness: int = 0
    feedback: str = ""
    suggested_answer: str = ""


class TailorDiff(BaseModel):
    """One diff between original and tailored resume content. Never adds new facts."""

    model_config = ConfigDict(extra="ignore")

    field: str = ""
    original: str = ""
    tailored: str = ""
    reasoning: str = ""


class TailorContent(BaseModel):
    """AI-derived tailored resume. Reviewable, never ground truth.

    Only rephrases, reorders and emphasizes existing content.
    Never fabricates experience, skills or qualifications.
    """

    model_config = ConfigDict(extra="ignore")

    tailored_content: ResumeContent = Field(default_factory=ResumeContent)
    diffs: list[TailorDiff] = Field(default_factory=list)


class LearningResourceContent(BaseModel):
    """A suggested learning resource for a missing skill."""

    model_config = ConfigDict(extra="ignore")

    title: str = ""
    url: str | None = None
    type: str = "course"
    provider: str | None = None


class SkillGapItem(BaseModel):
    """One skill in a gap analysis result."""

    model_config = ConfigDict(extra="ignore")

    skill: str = ""
    status: str = "missing"
    resume_evidence: str | None = None
    job_requirement: str = ""
    confidence: float = 0.0
    learning_resources: list[LearningResourceContent] | None = None


class GapAnalysisContent(BaseModel):
    """AI-derived skills gap analysis. Reviewable, never ground truth.

    Compares resume evidence against job requirements; a missing skill means
    the resume does not demonstrate it, not that the person lacks it.
    """

    model_config = ConfigDict(extra="ignore")

    matched_skills: list[SkillGapItem] = Field(default_factory=list)
    partial_skills: list[SkillGapItem] = Field(default_factory=list)
    missing_skills: list[SkillGapItem] = Field(default_factory=list)


class SalaryRangeContent(BaseModel):
    """AI-estimated market salary range. Advisory, never a guaranteed offer."""

    model_config = ConfigDict(extra="ignore")

    min_salary: float = 0.0
    max_salary: float = 0.0
    median_salary: float = 0.0
    currency: str = "INR"
    experience_level: str = "mid"
    confidence: float = 0.7


class NegotiationScriptContent(BaseModel):
    """AI-drafted negotiation guidance. Advisory talking points, not guarantees."""

    model_config = ConfigDict(extra="ignore")

    opening: str = ""
    justification_points: list[str] = Field(default_factory=list)
    handling_objections: list[str] = Field(default_factory=list)
    closing: str = ""


class SalaryAnalysisContent(BaseModel):
    """AI-derived salary estimate and negotiation script. Reviewable, never ground truth.

    Estimates are based on general market signals for the role and location;
    they are guidance to validate, not guaranteed compensation data.
    """

    model_config = ConfigDict(extra="ignore")

    salary_range: SalaryRangeContent = Field(default_factory=SalaryRangeContent)
    script: NegotiationScriptContent = Field(default_factory=NegotiationScriptContent)
