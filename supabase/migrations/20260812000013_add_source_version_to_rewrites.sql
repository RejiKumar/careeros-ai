-- CareerOS AI: add source version number to rewrite suggestions for audit trail.
alter table public.rewrite_suggestions
  add column source_version_number integer not null default 1;
