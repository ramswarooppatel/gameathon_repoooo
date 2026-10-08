-- FinCrew schema. Run in Supabase SQL editor (or apply as a migration).
-- Dashboard: Authentication -> Providers -> enable "Anonymous Sign-Ins".

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nickname text,
  seed int not null,
  status text not null default 'playing' check (status in ('playing','won','lost')),
  final_health int, ghost_health int,
  final_cash numeric, ghost_cash numeric,
  stars int, reaction_avg numeric, fraud_blocked numeric, fraud_lost numeric,
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  n int not null, day int not null, agent text not null, card_id text,
  decision jsonb not null, why text not null,
  prev_hash text not null, hash text not null,
  created_at timestamptz not null default now(),
  unique (run_id, n)
);
create index on public.runs (user_id);
create index on public.runs (stars desc, final_health desc) where status <> 'playing';
create index on public.ledger_entries (run_id);

alter table public.runs enable row level security;
alter table public.ledger_entries enable row level security;

create policy "own runs" on public.runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "finished runs are public (leaderboard)" on public.runs for select to anon, authenticated
  using (status <> 'playing');

create policy "own ledger read" on public.ledger_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own ledger insert" on public.ledger_entries for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.runs r where r.id = run_id and r.user_id = (select auth.uid())));
-- No update/delete policy on ledger_entries: append-only by design.
