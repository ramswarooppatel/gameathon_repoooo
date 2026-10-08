-- Oxro Labs internal finance desk: shared company workspace with roles, approvals and a party directory.
-- Roles: admin (everything) · finance (create/edit, no delete/approve/team) · viewer (read only).

-- ---------------------------------------------------------------- orgs + members
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  opening_balance numeric not null default 0,
  monthly_goal numeric not null default 0 check (monthly_goal >= 0),
  approval_limit numeric not null default 25000 check (approval_limit >= 0),
  allowed_domain text,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.orgs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('admin','finance','viewer')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.org_members (user_id);

-- Caller's role in an org (null if not a member). SECURITY DEFINER so policies can use it without recursion.
create or replace function public.org_role(p_org uuid)
returns text language sql stable security definer set search_path = ''
as $$ select role from public.org_members where org_id = p_org and user_id = (select auth.uid()) $$;
revoke execute on function public.org_role(uuid) from public, anon;
grant execute on function public.org_role(uuid) to authenticated;

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
create policy "members read org" on public.orgs for select to authenticated using (public.org_role(id) is not null);
create policy "admins update org" on public.orgs for update to authenticated
  using (public.org_role(id) = 'admin') with check (public.org_role(id) = 'admin');
create policy "members read members" on public.org_members for select to authenticated using (public.org_role(org_id) is not null);
-- No direct insert/update/delete on org_members: only the RPCs below.

create or replace function public.create_org(p_name text, p_display text, p_domain text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.org_members where user_id = (select auth.uid())) then raise exception 'you already belong to a workspace'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'company name required'; end if;
  insert into public.orgs (name, allowed_domain) values (trim(p_name), nullif(lower(trim(coalesce(p_domain, ''))), '')) returning id into v_org;
  insert into public.org_members (org_id, user_id, role, display_name) values (v_org, (select auth.uid()), 'admin', nullif(trim(p_display), ''));
  return v_org;
end $$;

create or replace function public.join_org(p_code text, p_display text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_org public.orgs; v_email text;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  select * into v_org from public.orgs where invite_code = lower(trim(p_code));
  if not found then raise exception 'invalid invite code'; end if;
  select email into v_email from auth.users where id = (select auth.uid());
  if v_org.allowed_domain is not null and lower(split_part(coalesce(v_email, ''), '@', 2)) <> v_org.allowed_domain then
    raise exception 'this workspace is limited to @% emails', v_org.allowed_domain;
  end if;
  insert into public.org_members (org_id, user_id, role, display_name)
  values (v_org.id, (select auth.uid()), 'viewer', nullif(trim(p_display), '')) on conflict do nothing;
  return v_org.id;
end $$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.org_role(p_org) is distinct from 'admin' then raise exception 'admins only'; end if;
  if p_role not in ('admin','finance','viewer') then raise exception 'bad role'; end if;
  if p_role <> 'admin' and (select role from public.org_members where org_id = p_org and user_id = p_user) = 'admin'
     and (select count(*) from public.org_members where org_id = p_org and role = 'admin') < 2 then
    raise exception 'a workspace needs at least one admin';
  end if;
  update public.org_members set role = p_role where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.org_role(p_org) is distinct from 'admin' then raise exception 'admins only'; end if;
  if (select role from public.org_members where org_id = p_org and user_id = p_user) = 'admin'
     and (select count(*) from public.org_members where org_id = p_org and role = 'admin') < 2 then
    raise exception 'a workspace needs at least one admin';
  end if;
  delete from public.org_members where org_id = p_org and user_id = p_user;
end $$;

revoke execute on function public.create_org(text, text, text), public.join_org(text, text), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.create_org(text, text, text), public.join_org(text, text), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- parties (customers + vendors)
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  kind text not null default 'customer' check (kind in ('customer','vendor')),
  name text not null, gstin text, email text, phone text, notes text,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, kind, name)
);
create index on public.parties (org_id);

-- ---------------------------------------------------------------- move shared tables from per-user to per-org
alter table public.entries
  add column if not exists org_id uuid references public.orgs on delete cascade,
  add column if not exists approval text not null default 'approved' check (approval in ('approved','pending','rejected')),
  add column if not exists approval_note text,
  add column if not exists created_by uuid default auth.uid() references auth.users on delete set null;
alter table public.filings add column if not exists org_id uuid references public.orgs on delete cascade;
alter table public.recurring add column if not exists org_id uuid references public.orgs on delete cascade;
alter table public.activity_log add column if not exists org_id uuid references public.orgs on delete cascade;
create index on public.entries (org_id, date desc);
create index on public.filings (org_id);
create index on public.recurring (org_id);
create index on public.activity_log (org_id);

alter table public.filings drop constraint if exists filings_user_id_type_period_key;
alter table public.filings add constraint filings_org_type_period_key unique (org_id, type, period);

drop policy if exists "own entries" on public.entries;
drop policy if exists "own filings" on public.filings;
drop policy if exists "own recurring" on public.recurring;
drop policy if exists "own log read" on public.activity_log;
drop policy if exists "own log insert" on public.activity_log;

-- entries
create policy "org read entries" on public.entries for select to authenticated using (public.org_role(org_id) is not null);
create policy "org write entries" on public.entries for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org update entries" on public.entries for update to authenticated
  using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "admin delete entries" on public.entries for delete to authenticated using (public.org_role(org_id) = 'admin');

-- filings
create policy "org read filings" on public.filings for select to authenticated using (public.org_role(org_id) is not null);
create policy "org write filings" on public.filings for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org update filings" on public.filings for update to authenticated
  using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "admin delete filings" on public.filings for delete to authenticated using (public.org_role(org_id) = 'admin');

-- recurring
create policy "org read recurring" on public.recurring for select to authenticated using (public.org_role(org_id) is not null);
create policy "org write recurring" on public.recurring for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org update recurring" on public.recurring for update to authenticated
  using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "org delete recurring" on public.recurring for delete to authenticated using (public.org_role(org_id) in ('admin','finance'));

-- parties
alter table public.parties enable row level security;
create policy "org read parties" on public.parties for select to authenticated using (public.org_role(org_id) is not null);
create policy "org write parties" on public.parties for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org update parties" on public.parties for update to authenticated
  using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "admin delete parties" on public.parties for delete to authenticated using (public.org_role(org_id) = 'admin');

-- audit log: you see your own records; admins see the whole company's.
create policy "log read own or admin" on public.activity_log for select to authenticated
  using ((select auth.uid()) = user_id or public.org_role(org_id) = 'admin');
create policy "log insert own" on public.activity_log for insert to authenticated
  with check ((select auth.uid()) = user_id and (org_id is null or public.org_role(org_id) is not null));

-- ---------------------------------------------------------------- server-side approval rules
-- Non-admins' money-out entries above the org limit are forced to 'pending'. Only admins change approval status.
create or replace function public.entries_approval_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare lim numeric;
begin
  if tg_op = 'INSERT' then
    new.approval := 'approved';
    if new.kind <> 'sale' and public.org_role(new.org_id) is distinct from 'admin' then
      select approval_limit into lim from public.orgs where id = new.org_id;
      if new.taxable * (1 + new.gst_rate / 100) > coalesce(lim, 25000) then new.approval := 'pending'; end if;
    end if;
  elsif new.approval is distinct from old.approval or new.approval_note is distinct from old.approval_note then
    if public.org_role(new.org_id) is distinct from 'admin' then raise exception 'only admins can approve or reject'; end if;
  end if;
  return new;
end $$;
create trigger entries_approval_guard before insert or update on public.entries
  for each row execute function public.entries_approval_guard();

-- ---------------------------------------------------------------- team leaderboard (replaces the global one)
create or replace function public.get_leaderboard()
returns table (nickname text, xp bigint, health int)
language sql stable security definer set search_path = ''
as $$
  select coalesce(m.display_name, 'Member'), coalesce(sum(x.xp), 0)::bigint, null::int
  from public.org_members m left join public.xp_events x on x.user_id = m.user_id
  where m.org_id = (select org_id from public.org_members where user_id = (select auth.uid()) limit 1)
  group by m.user_id, m.display_name order by 2 desc limit 50
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parties') then
    alter publication supabase_realtime add table public.parties;
  end if;
end $$;
