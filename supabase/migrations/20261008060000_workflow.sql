-- Guided finance workflow: category budgets (per org) + manual checklist ticks for weekly / month-end routines.
alter table public.orgs add column if not exists budgets jsonb not null default '{}'::jsonb;

create table public.checklist_ticks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  period text not null,                       -- '2026-09' (month close), '2026-W40' (weekly) or '2026-10-08' (daily)
  item text not null,
  done_by uuid default auth.uid() references auth.users on delete set null,
  done_at timestamptz not null default now(),
  unique (org_id, period, item)
);
create index on public.checklist_ticks (org_id, period);

alter table public.checklist_ticks enable row level security;
create policy "org read ticks" on public.checklist_ticks for select to authenticated using (public.org_role(org_id) is not null);
create policy "org write ticks" on public.checklist_ticks for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org delete ticks" on public.checklist_ticks for delete to authenticated using (public.org_role(org_id) in ('admin','finance'));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checklist_ticks') then
    alter publication supabase_realtime add table public.checklist_ticks;
  end if;
end $$;
