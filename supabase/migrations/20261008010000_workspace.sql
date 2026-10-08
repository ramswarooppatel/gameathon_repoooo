-- Business workspace: real (non-game) bookkeeping per user. Requires email sign-in (not anonymous).
create table public.business_profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text, gstin text,
  opening_balance numeric not null default 0,
  updated_at timestamptz not null default now()
);
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('sale','purchase')),
  number text, party text not null, gstin text,
  date date not null, due_date date,
  taxable numeric not null check (taxable >= 0),
  gst_rate numeric not null default 18 check (gst_rate in (0,5,12,18,28,40)),
  supply text not null default 'intra' check (supply in ('intra','inter')),
  paid_date date, note text,
  created_at timestamptz not null default now()
);
create index on public.entries (user_id, date desc);
alter table public.business_profiles enable row level security;
alter table public.entries enable row level security;
create policy "own profile" on public.business_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own entries" on public.entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
