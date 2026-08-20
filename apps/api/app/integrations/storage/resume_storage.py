"""Resume endpoint schemas and storage of uploaded resumes.

Original files live in the private Supabase ``resumes`` bucket under
``<user_id>/<resume_id>_imported.<ext>``; access uses server-issued signed URLs.
"""

from __future__ import annotations

from app.integrations.supabase.client import SupabaseClients, require_service_client
from supabase import Client

_RESUMES_BUCKET = "resumes"
MAX_RESUME_BYTES = 10 * 1024 * 1024

ALLOWED_EXTENSIONS: dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}

# Some mobile clients send application/octet-stream for .docx and .pdf.
_PERMISSIVE_MIME_TYPES = {"application/octet-stream", "application/zip"}


def validate_upload(filename: str, content_type: str | None, size: int) -> None:
    """Validate extension, MIME type and size of an uploaded resume file.

    Raises ValueError with a stable message when the upload is not acceptable.
    """
    if size <= 0:
        raise ValueError("Uploaded file is empty.")
    if size > MAX_RESUME_BYTES:
        raise ValueError("Uploaded file exceeds the 10 MB limit.")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type. Use PDF, DOCX or TXT.")
    if content_type and content_type not in _PERMISSIVE_MIME_TYPES:
        if content_type.split(";")[0].strip() != ALLOWED_EXTENSIONS[ext]:
            raise ValueError("File content type does not match its extension.")


def extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def upload_original(
    clients: SupabaseClients, *, user_id: str, resume_id: str, filename: str, content: bytes
) -> None:
    """Upload the original file to the user's private storage folder."""
    client: Client = require_service_client(clients)
    path = f"{user_id}/{resume_id}_imported.{extension_of(filename)}"
    client.storage.from_(_RESUMES_BUCKET).upload(
        path,
        content,
        {"content-type": ALLOWED_EXTENSIONS[extension_of(filename)], "upsert": "false"},
    )


def signed_url(
    clients: SupabaseClients, *, user_id: str, resume_id: str, filename: str
) -> str | None:
    """Return a short-lived signed URL for the original file, if it exists."""
    client: Client = require_service_client(clients)
    path = f"{user_id}/{resume_id}_imported.{extension_of(filename)}"
    result = client.storage.from_(_RESUMES_BUCKET).create_signed_url(path, 3600)
    if not result or not result.get("signedURL"):
        return None
    return result["signedURL"]
