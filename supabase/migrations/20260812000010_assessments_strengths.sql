-- CareerOS AI: store assessment strengths (immutable, like the rest of the row).

alter table public.assessments
  add column strengths jsonb not null default '[]';
