"""Auth endpoint schemas."""

from __future__ import annotations

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None
