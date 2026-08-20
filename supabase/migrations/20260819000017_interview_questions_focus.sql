-- Add the missing `focus` column to interview_questions.
-- Migration 14 created the table without it; the interviews module stores a
-- per-question focus area, so backfill it and make it required going forward.

alter table public.interview_questions
  add column if not exists focus text not null default '';

create index if not exists idx_interview_questions_session
  on public.interview_questions(session_id);
