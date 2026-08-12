-- CareerOS AI: feature usage events and entitlements.

-- Append-only usage log for feature metering. Written exclusively by the
-- API with the service-role key; clients may only read their own rows so
-- usage cannot be spoofed client-side.
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('assess', 'match', 'rewrite', 'coach')),
  event_key text not null,
  quantity integer not null default 1 check (quantity >= 1),
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create policy "usage_events_select_own" on public.usage_events
  for select using (auth.uid() = user_id);

create index usage_events_user_feature_created_idx
  on public.usage_events (user_id, feature, created_at desc);

-- Entitlements gate premium features. Managed server-side; clients may
-- read their own row but never mutate it.
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null default 'free'
    check (plan in ('free', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'grace', 'expired')),
  provider text,
  provider_product_id text,
  purchase_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = user_id);

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();
