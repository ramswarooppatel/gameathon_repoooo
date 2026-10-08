-- Finance manager: expense/payroll kinds, compliance filings, XP/badges engagement, tamper-evident activity log, leaderboard.
alter table public.entries drop constraint if exists entries_kind_check;
alter table public.entries add constraint entries_kind_check check (kind in ('sale','purchase','expense','salary'));
alter table public.entries add column if not exists category text;

alter table public.business_profiles
  add column if not exists nickname text,
  add column if not exists leaderboard_opt_in boolean not null default false,
  add column if not exists health int;

create table public.filings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('GSTR1','GSTR3B','PF','TDS')),
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  due_date date not null, filed_date date,
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, type, period)
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null, ref text not null default '', day text not null,
  xp int not null check (xp between 0 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

create table public.badges (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  code text not null, earned_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- Mirrors ledger/blackbox.js entries: hash = SHA-256(prev_hash + canonical(n,day,agent,ref,decision,why)).
create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  n int not null, day text not null, agent text not null, ref text,
  decision jsonb not null, why text not null,
  prev_hash text not null, hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, n)
);

create index on public.filings (user_id, due_date);
create index on public.xp_events (user_id, day);
create index on public.activity_log (user_id, n);

alter table public.filings enable row level security;
alter table public.xp_events enable row level security;
alter table public.badges enable row level security;
alter table public.activity_log enable row level security;

create policy "own filings" on public.filings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own xp read" on public.xp_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "own xp insert" on public.xp_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own badges read" on public.badges for select to authenticated using ((select auth.uid()) = user_id);
create policy "own badges insert" on public.badges for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own log read" on public.activity_log for select to authenticated using ((select auth.uid()) = user_id);
create policy "own log insert" on public.activity_log for insert to authenticated with check ((select auth.uid()) = user_id);
-- No update/delete policies on xp_events, badges, activity_log: append-only.
-- Known limit: XP is client-awarded (capped 0..500 per event, unique per kind+ref). Move to an RPC/trigger if cheating matters.

create or replace function public.get_leaderboard()
returns table (nickname text, xp bigint, health int)
language sql stable security definer set search_path = ''
as $$
  select p.nickname, coalesce(sum(x.xp), 0)::bigint, p.health
  from public.business_profiles p left join public.xp_events x on x.user_id = p.user_id
  where p.leaderboard_opt_in and p.nickname is not null
  group by p.user_id, p.nickname, p.health
  order by 2 desc limit 20
$$;
revoke execute on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;
