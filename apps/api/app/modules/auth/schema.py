"""Auth endpoint schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


class GuestMigrationRequest(BaseModel):
    guest_id: str = Field(min_length=36, max_length=36)


class GuestMigrationResponse(BaseModel):
    migrated_records: int
    guest_id: str
