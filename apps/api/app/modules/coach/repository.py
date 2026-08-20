"""Coach thread and message persistence backed by Supabase (service-role client)."""

from __future__ import annotations

from supabase import Client

COACH_THREADS_TABLE = "coach_threads"
COACH_MESSAGES_TABLE = "coach_messages"


class CoachRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create_thread(
        self, *, user_id: str, title: str | None, context: dict | None
    ) -> dict:
        rows = (
            self._client.table(COACH_THREADS_TABLE)
            .insert({"user_id": user_id, "title": title, "context": context})
            .execute()
            .data
        )
        return rows[0]

    def get_thread(self, *, user_id: str, thread_id: str) -> dict | None:
        rows = (
            self._client.table(COACH_THREADS_TABLE)
            .select("*")
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_threads(self, *, user_id: str) -> list[dict]:
        return (
            self._client.table(COACH_THREADS_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
            .data
        )

    def create_message(
        self, *, user_id: str, thread_id: str, role: str, content: str, request_id: str | None
    ) -> dict:
        rows = (
            self._client.table(COACH_MESSAGES_TABLE)
            .insert(
                {
                    "user_id": user_id,
                    "thread_id": thread_id,
                    "role": role,
                    "content": content,
                    "request_id": request_id,
                }
            )
            .execute()
            .data
        )
        return rows[0]

    def update_thread(
        self,
        *,
        user_id: str,
        thread_id: str,
        title: str | None,
        context: dict | None,
    ) -> dict | None:
        updates: dict = {}
        if title is not None:
            updates["title"] = title
        if context is not None:
            updates["context"] = context
        if not updates:
            return self.get_thread(user_id=user_id, thread_id=thread_id)
        rows = (
            self._client.table(COACH_THREADS_TABLE)
            .update(updates)
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def delete_thread(self, *, user_id: str, thread_id: str) -> None:
        self._client.table(COACH_THREADS_TABLE).delete().eq("id", thread_id).eq(
            "user_id", user_id
        ).execute()

    def list_messages(
        self, *, thread_id: str, limit: int = 50, offset: int = 0
    ) -> list[dict]:
        rows = (
            self._client.table(COACH_MESSAGES_TABLE)
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
            .data
        )
        return list(rows)
