-- ─────────────────────────────────────────────────────────────────────────────
-- Program Timer — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles ──────────────────────────────────────────────────────────────────
-- One row per auth user, auto-created on signup via trigger below.
-- plan is managed by RevenueCat webhooks (Phase 2) — default 'free'.

create table if not exists public.profiles (
  id            uuid        primary key references auth.users on delete cascade,
  email         text,
  full_name     text,
  plan          text        not null default 'free'
                            check (plan in ('free', 'premium1', 'premium2', 'premium3')),
  revenuecat_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: users can only read/update their own profile
alter table public.profiles enable row level security;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Service role bypasses RLS (used by server for RevenueCat webhook updates)
create policy "profiles: service role all"
  on public.profiles
  using (auth.role() = 'service_role');

-- ── Auto-create profile on signup ────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Updated-at trigger ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ── Productions ───────────────────────────────────────────────────────────────
-- A production is a named project (e.g. "Annual Conference 2025").
-- Each user owns their own productions.

create table if not exists public.productions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users on delete cascade not null,
  name       text        not null,
  created_at timestamptz not null default now()
);

alter table public.productions enable row level security;

create policy "productions: own all"
  on public.productions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Events ────────────────────────────────────────────────────────────────────
-- An event is a single show day within a production.
-- schedule stores the full ScheduleItem[] array as JSON.

create table if not exists public.events (
  id            uuid        primary key default gen_random_uuid(),
  production_id uuid        references public.productions on delete cascade not null,
  user_id       uuid        references auth.users on delete cascade not null,
  name          text        not null,
  schedule      jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events: own all"
  on public.events for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
