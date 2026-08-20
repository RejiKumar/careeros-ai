"""Resume endpoint schemas (typed public API contract)."""

from __future__ import annotations

from pydantic import BaseModel, model_validator

from app.ai.schemas import ResumeContent


class ResumeResponse(BaseModel):
    id: str
    title: str
    status: str
    current_version_id: str | None
    created_at: str
    updated_at: str


class ResumeVersionResponse(BaseModel):
    id: str
    resume_id: str
    version: int
    source: str
    created_at: str


class ResumeImportResponse(BaseModel):
    resume: ResumeResponse
    version: ResumeVersionResponse
    parsed: ResumeContent
    file_url: str | None = None


class ResumeDetailResponse(BaseModel):
    resume: ResumeResponse
    version: ResumeVersionResponse | None
    parsed: ResumeContent | None
    file_url: str | None = None


class ResumeUpdateRequest(BaseModel):
    """Editor payload: rename the resume and/or save edited structured content.

    At least one of ``title`` or ``structured_data`` must be provided.
    Saving structured data always creates a new immutable version snapshot.
    """

    title: str | None = None
    structured_data: ResumeContent | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> ResumeUpdateRequest:
        if self.title is None and self.structured_data is None:
            raise ValueError("Provide title and/or structured_data to update the resume.")
        if self.title is not None and not self.title.strip():
            raise ValueError("Resume title cannot be empty.")
        return self
