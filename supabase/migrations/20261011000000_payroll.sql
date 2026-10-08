-- Payroll: employees, monthly runs, payslips. Salary data is sensitive: only admins and finance can read or write it (viewers see nothing).
-- Maker-checker: finance prepares a run, an admin approves it, and when the company has another admin the approver cannot be the preparer.
-- Once a run leaves 'draft' its payslips are locked.

alter table public.orgs add column if not exists payroll_settings jsonb not null default '{}'::jsonb;   -- pay day, PF/ESI registration numbers, TAN
alter table public.entries add column if not exists payroll_run_id uuid;                                -- entries created by an approved run
create index if not exists entries_payroll_idx on public.entries (payroll_run_id) where payroll_run_id is not null;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  code text, name text not null check (char_length(name) between 1 and 120), designation text,
  email text, phone text, pan text, uan text, bank_acc text, ifsc text,
  join_date date, left_date date,
  basic numeric not null check (basic > 0), hra numeric not null default 0 check (hra >= 0), allowances numeric not null default 0 check (allowances >= 0),
  pf_on boolean not null default true, pf_cap boolean not null default true, esi_on boolean not null default false,
  pt_state text not null default 'none', pt_flat numeric not null default 0,
  tds_on boolean not null default false, tds_fixed numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);
create index on public.employees (org_id);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft','pending','approved','paid')),
  pay_date date,
  totals jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid default auth.uid() references auth.users on delete set null,
  approved_by uuid references auth.users on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, period)
);
create index on public.payroll_runs (org_id, period desc);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs on delete cascade,
  org_id uuid not null references public.orgs on delete cascade,
  employee_id uuid references public.employees on delete set null,
  employee jsonb not null default '{}'::jsonb,        -- snapshot at run time (name, PAN, UAN, bank)
  input jsonb not null default '{}'::jsonb,           -- attendance and one-time items
  calc jsonb not null default '{}'::jsonb,            -- every computed figure
  net numeric not null default 0,
  unique (run_id, employee_id)
);
create index on public.payslips (run_id);

alter table public.employees enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
create policy "payroll staff read employees" on public.employees for select to authenticated using (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff write employees" on public.employees for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff update employees" on public.employees for update to authenticated using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "admin delete employees" on public.employees for delete to authenticated using (public.org_role(org_id) = 'admin');
create policy "payroll staff read runs" on public.payroll_runs for select to authenticated using (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff write runs" on public.payroll_runs for insert to authenticated with check (public.org_role(org_id) in ('admin','finance') and status in ('draft','pending'));
create policy "payroll staff update runs" on public.payroll_runs for update to authenticated using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff delete draft runs" on public.payroll_runs for delete to authenticated using (status = 'draft' and public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff read payslips" on public.payslips for select to authenticated using (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff write payslips" on public.payslips for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff update payslips" on public.payslips for update to authenticated using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "payroll staff delete payslips" on public.payslips for delete to authenticated using (public.org_role(org_id) in ('admin','finance'));

-- Status changes: finance can move draft <-> pending; only an admin can approve or mark paid, and not their own run when another admin exists.
create or replace function public.payroll_runs_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare admins int;
begin
  if tg_op = 'INSERT' then return new; end if;
  if old.status in ('approved','paid') and (new.period is distinct from old.period or new.totals is distinct from old.totals) then
    raise exception 'an approved payroll run cannot be edited';
  end if;
  if new.status is distinct from old.status and new.status in ('approved','paid') then
    if public.org_role(new.org_id) is distinct from 'admin' then raise exception 'only an admin can approve or pay a payroll run'; end if;
    select count(*) into admins from public.org_members where org_id = new.org_id and role = 'admin';
    if new.status = 'approved' then
      if admins > 1 and old.created_by = (select auth.uid()) then raise exception 'a different admin must approve this run'; end if;
      new.approved_by := (select auth.uid()); new.approved_at := now();
    else new.paid_at := now(); end if;
  end if;
  if old.status in ('approved','paid') and new.status in ('draft','pending') then raise exception 'an approved payroll run cannot go back to draft'; end if;
  return new;
end $$;
create trigger payroll_runs_guard before update on public.payroll_runs for each row execute function public.payroll_runs_guard();

-- Payslips of a run that is no longer a draft or pending cannot change.
create or replace function public.payslips_lock()
returns trigger language plpgsql set search_path = ''
as $$
declare st text;
begin
  select status into st from public.payroll_runs where id = coalesce(new.run_id, old.run_id);
  if st in ('approved','paid') then raise exception 'payslips of an approved run are locked'; end if;
  return coalesce(new, old);
end $$;
create trigger payslips_lock before insert or update or delete on public.payslips for each row execute function public.payslips_lock();
