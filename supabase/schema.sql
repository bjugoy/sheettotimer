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
