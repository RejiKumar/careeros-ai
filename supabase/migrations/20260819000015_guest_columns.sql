-- CareerOS AI: guest ownership on assessment and job match rows.
alter table public.assessments
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;
alter table public.job_matches
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;

create index if not exists idx_assessments_guest_id on public.assessments(guest_id);
create index if not exists idx_job_matches_guest_id on public.job_matches(guest_id);
