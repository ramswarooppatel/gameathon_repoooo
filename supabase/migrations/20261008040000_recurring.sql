-- Recurring entry templates (rent, payroll, subscriptions). The app generates one entry per month on open.
create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('sale','purchase','expense','salary')),
  party text not null, gstin text, category text,
  taxable numeric not null check (taxable >= 0),
  gst_rate numeric not null default 0 check (gst_rate in (0,5,12,18,28,40)),
  day_of_month int not null check (day_of_month between 1 and 28),
  start_month text not null check (start_month ~ '^\d{4}-\d{2}$'),
  last_generated text check (last_generated ~ '^\d{4}-\d{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.recurring (user_id);
alter table public.recurring enable row level security;
create policy "own recurring" on public.recurring for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
