"""Interview session persistence (user or guest ownership)."""

from __future__ import annotations

from supabase import Client


class InterviewRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create_session(
        self,
        *,
        mode: str,
        actor_id: str,
        is_guest: bool,
        resume_id: str | None,
        target_job: str | None,
        target_skills: list[str],
        request_id: str,
        model_version: str,
    ) -> dict:
        row = {
            "mode": mode,
            "resume_id": resume_id,
            "target_job": target_job,
            "target_skills": target_skills,
            "request_id": request_id,
            "model_version": model_version,
        }
        if is_guest:
            row["guest_id"] = actor_id
        else:
            row["user_id"] = actor_id
        return self._client.table("interview_sessions").insert(row).execute().data[0]

    def get_session(self, *, session_id: str, actor_id: str, is_guest: bool) -> dict | None:
        query = self._client.table("interview_sessions").select("*").eq("id", session_id)
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        rows = query.execute().data
        return rows[0] if rows else None

    def list_sessions(self, *, actor_id: str, is_guest: bool) -> list[dict]:
        query = self._client.table("interview_sessions").select("*").order("created_at", desc=True)
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        return query.execute().data

    def get_parsed_resume(self, *, resume_id: str, actor_id: str, is_guest: bool) -> dict | None:
        query = self._client.table("resumes").select("id, current_version_id").eq("id", resume_id)
        query = query.eq("guest_id", actor_id) if is_guest else query.eq("user_id", actor_id)
        rows = query.execute().data
        if not rows or not rows[0].get("current_version_id"):
            return None
        version_rows = (
            self._client.table("resume_versions")
            .select("structured_data")
            .eq("id", rows[0]["current_version_id"])
            .execute()
            .data
        )
        if not version_rows:
            return None
        structured = version_rows[0].get("structured_data")
        return structured if structured is not None else {}

    def create_questions(self, *, session_id: str, questions: list[dict]) -> list[dict]:
        rows = [
            self._client.table("interview_questions")
            .insert({"session_id": session_id, "question": q["question"], "focus": q["focus"]})
            .execute()
            .data[0]
            for q in questions
        ]
        return rows

    def list_questions(self, *, session_id: str) -> list[dict]:
        return (
            self._client.table("interview_questions")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
            .data
        )

    def get_question(self, *, question_id: str, session_id: str) -> dict | None:
        rows = (
            self._client.table("interview_questions")
            .select("*")
            .eq("id", question_id)
            .eq("session_id", session_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def create_answer(
        self,
        *,
        question_id: str,
        content: str,
        evaluation: dict,
        request_id: str,
        model_version: str,
    ) -> dict:
        return (
            self._client.table("interview_answers")
            .insert(
                {
                    "question_id": question_id,
                    "content": content,
                    "evaluation": evaluation,
                    "request_id": request_id,
                    "model_version": model_version,
                }
            )
            .execute()
            .data[0]
        )

    def get_answer_for_question(self, *, question_id: str) -> dict | None:
        rows = (
            self._client.table("interview_answers")
            .select("*")
            .eq("question_id", question_id)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def complete_session(self, *, session_id: str) -> None:
        self._client.table("interview_sessions").update({"status": "completed"}).eq(
            "id", session_id
        ).execute()
