-- CareerOS AI: missions catalog, mission completions and XP totals.

-- Missions are a global read-only catalog maintained by the product team.
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  cadence text not null default 'daily'
    check (cadence in ('daily', 'weekly', 'once')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy "missions_read" on public.missions
  for select to authenticated using (true);

-- User progress: one completion row per mission per day.
create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  completed_on date not null default current_date,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, mission_id, completed_on)
);

alter table public.mission_completions enable row level security;

-- Insert + select only: XP is awarded by the server using the service role,
-- so a client cannot fabricate completions.
create policy "mission_completions_select_own" on public.mission_completions
  for select using (auth.uid() = user_id);
create policy "mission_completions_insert_own" on public.mission_completions
  for insert with check (auth.uid() = user_id);

-- security_invoker = true so the view inherits the caller's RLS on
-- mission_completions instead of running as the (privileged) view owner.
create or replace view public.user_xp
with (security_invoker = true) as
select
  user_id,
  sum(xp_awarded) as total_xp,
  count(*) as missions_completed
from public.mission_completions
group by user_id;
