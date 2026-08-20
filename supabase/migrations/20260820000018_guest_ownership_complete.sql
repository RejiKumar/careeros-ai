-- CareerOS AI: complete guest ownership across progress, coach and resume tables.
-- Guest rows are API-only (service role); REST policies stay user-only.

-- Resume ownership columns become optional so guests can own rows too.
alter table public.resumes alter column user_id drop not null;
alter table public.resume_versions
  alter column user_id drop not null,
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;
alter table public.job_descriptions alter column user_id drop not null;
alter table public.assessments alter column user_id drop not null;
alter table public.job_matches alter column user_id drop not null;
alter table public.coach_threads alter column user_id drop not null;
alter table public.coach_messages
  alter column user_id drop not null,
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;

-- Mission progress and achievements support guests.
alter table public.mission_completions
  alter column user_id drop not null,
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;
alter table public.user_achievements
  alter column user_id drop not null,
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;

create index if not exists idx_resume_versions_guest_id on public.resume_versions(guest_id);
create index if not exists idx_coach_messages_guest_id on public.coach_messages(guest_id);
create index if not exists idx_mission_completions_guest_id on public.mission_completions(guest_id);
create index if not exists idx_user_achievements_guest_id on public.user_achievements(guest_id);

-- One earned achievement per guest per definition.
create unique index if not exists uq_user_achievements_guest
  on public.user_achievements(guest_id, achievement_id) where guest_id is not null;
