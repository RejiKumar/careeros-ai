"""Resume use cases: import + parse, list and detail.

The router stays thin; this service owns the import/parse flow, validation and
ownership checks.
"""

from __future__ import annotations

from fastapi import status

from app.ai.provider import CareerAiProvider, ProviderError
from app.ai.schemas import ResumeContent
from app.core.auth import CurrentActor
from app.core.errors import AppError
from app.core.owner import owner_fields
from app.integrations.storage.resume_storage import (
    signed_url,
    upload_original,
    validate_upload,
)
from app.integrations.supabase.client import SupabaseClients, require_service_client

from .repository import ResumeRepository
from .schema import (
    ResumeDetailResponse,
    ResumeImportResponse,
    ResumeResponse,
    ResumeVersionResponse,
)
from .text_extraction import extract_text


class UploadValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(
            code="invalid_upload", message=message, status_code=status.HTTP_400_BAD_REQUEST
        )


class AiProviderError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ai_provider_error",
            message="The resume could not be parsed right now. Please try again.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class ResumeNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="not_found",
            message="Resume not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ResumeService:
    def __init__(self, clients: SupabaseClients, provider: CareerAiProvider) -> None:
        self._clients = clients
        self._provider = provider
        self._repository = ResumeRepository(require_service_client(clients))

    def import_resume(
        self,
        actor: CurrentActor,
        *,
        filename: str,
        content_type: str | None,
        content: bytes,
        original_url: bool = False,
    ) -> ResumeImportResponse:
        try:
            validate_upload(filename, content_type, len(content))
        except ValueError as exc:
            raise UploadValidationError(str(exc)) from exc

        try:
            text = extract_text(filename, content)
        except ValueError as exc:
            raise UploadValidationError(str(exc)) from exc
        if not text.strip():
            raise UploadValidationError("No readable text found in the file.")

        resume = self._repository.create_resume(
            owner=owner_fields(actor), title=_default_title(filename)
        )

        try:
            parsed = self._provider.parse_resume(text)
            version = self._repository.create_version(
                resume_id=resume["id"],
                owner=owner_fields(actor),
                version=1,
                source="import",
                structured_data=parsed.content.model_dump(mode="json"),
                source_request_id=parsed.request_id,
            )
            self._repository.set_current_version(resume_id=resume["id"], version_id=version["id"])
            upload_original(
                self._clients,
                user_id=actor.id,
                resume_id=resume["id"],
                filename=filename,
                content=content,
            )
        except ProviderError as exc:
            self._repository.delete_resume(resume_id=resume["id"])
            raise AiProviderError() from exc
        except Exception:
            self._repository.delete_resume(resume_id=resume["id"])
            raise

        file_url = (
            signed_url(
                self._clients,
                user_id=actor.id,
                resume_id=resume["id"],
                filename=filename,
            )
            if original_url
            else None
        )
        return ResumeImportResponse(
            resume=_to_resume_response(resume),
            version=_to_version_response(version),
            parsed=parsed.content,
            file_url=file_url,
        )

    def list_resumes(self, actor: CurrentActor) -> list[ResumeResponse]:
        rows = self._repository.list_resumes(actor=actor)
        return [_to_resume_response(row) for row in rows]

    def get_resume(self, actor: CurrentActor, resume_id: str) -> ResumeDetailResponse:
        resume = self._repository.get_resume(actor=actor, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()
        version = None
        parsed = None
        if resume.get("current_version_id"):
            version_row = self._repository.get_version(
                resume_id=resume_id, version_id=resume["current_version_id"]
            )
            if version_row:
                version = _to_version_response(version_row)
                parsed = _to_parsed_content(version_row.get("structured_data"))
        return ResumeDetailResponse(
            resume=_to_resume_response(resume), version=version, parsed=parsed
        )

    def list_versions(self, actor: CurrentActor, resume_id: str) -> list[ResumeVersionResponse]:
        resume = self._repository.get_resume(actor=actor, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()
        rows = self._repository.list_versions(resume_id=resume_id)
        return [_to_version_response(row) for row in rows]

    def update_resume(
        self,
        actor: CurrentActor,
        resume_id: str,
        *,
        title: str | None,
        structured_data: ResumeContent | None,
    ) -> ResumeDetailResponse:
        resume = self._repository.get_resume(actor=actor, resume_id=resume_id)
        if resume is None:
            raise ResumeNotFoundError()

        if structured_data is not None:
            latest = self._repository.get_latest_version(resume_id=resume_id)
            next_version = latest["version"] + 1 if latest else 1
            version = self._repository.create_version(
                resume_id=resume_id,
                owner=owner_fields(actor),
                version=next_version,
                source="edit",
                structured_data=structured_data.model_dump(mode="json"),
                source_request_id=None,
            )
            self._repository.set_current_version(resume_id=resume_id, version_id=version["id"])

        if title is not None and title != resume["title"]:
            self._repository.update_title(resume_id=resume_id, title=title.strip())

        return self.get_resume(actor, resume_id)


def _default_title(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0].strip() if "." in filename else filename.strip()
    return stem[:80] or "My Resume"


def _to_resume_response(row: dict) -> ResumeResponse:
    return ResumeResponse(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        current_version_id=row.get("current_version_id"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_version_response(row: dict) -> ResumeVersionResponse:
    return ResumeVersionResponse(
        id=row["id"],
        resume_id=row["resume_id"],
        version=row["version"],
        source=row["source"],
        created_at=row["created_at"],
    )


def _to_parsed_content(structured_data: dict | None) -> ResumeContent | None:
    if not structured_data:
        return None
    try:
        return ResumeContent.model_validate(structured_data)
    except Exception:
        return None

