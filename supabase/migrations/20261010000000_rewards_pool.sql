-- Company-funded rewards. The platform never holds or moves money: the company sets a monthly pool, members redeem XP for items
-- the company defined, an admin approves, and the company fulfils the reward itself (voucher, lunch, leave).
-- The database enforces the XP balance and the monthly pool, so a tampered client cannot overspend.

alter table public.orgs add column if not exists reward_pool_monthly numeric not null default 0 check (reward_pool_monthly >= 0);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text,
  xp_cost int not null check (xp_cost > 0),
  cost_inr numeric not null default 0 check (cost_inr >= 0),          -- what the company pays when it fulfils this reward
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index on public.rewards (org_id);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  reward_id uuid references public.rewards on delete set null,
  reward_name text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  member_name text,
  xp_cost int not null,
  cost_inr numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','fulfilled','rejected')),
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index on public.redemptions (org_id, created_at desc);
create index on public.redemptions (user_id);

alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
create policy "org read rewards" on public.rewards for select to authenticated using (public.org_role(org_id) is not null);
create policy "admin write rewards" on public.rewards for insert to authenticated with check (public.org_role(org_id) = 'admin');
create policy "admin update rewards" on public.rewards for update to authenticated using (public.org_role(org_id) = 'admin') with check (public.org_role(org_id) = 'admin');
create policy "admin delete rewards" on public.rewards for delete to authenticated using (public.org_role(org_id) = 'admin');
create policy "read own or admin redemptions" on public.redemptions for select to authenticated using (user_id = (select auth.uid()) or public.org_role(org_id) = 'admin');
create policy "member requests redemption" on public.redemptions for insert to authenticated with check (user_id = (select auth.uid()) and public.org_role(org_id) is not null);
create policy "admin decides redemption" on public.redemptions for update to authenticated using (public.org_role(org_id) = 'admin') with check (public.org_role(org_id) = 'admin');

-- Server-side rules. SECURITY DEFINER because it must total other members' redemptions for the pool check.
create or replace function public.redemptions_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare r public.rewards; earned bigint; spent bigint; pool numeric; used numeric;
begin
  if tg_op = 'INSERT' then
    select * into r from public.rewards where id = new.reward_id and org_id = new.org_id and active;
    if not found then raise exception 'reward not available'; end if;
    new.reward_name := r.name; new.xp_cost := r.xp_cost; new.cost_inr := r.cost_inr; new.status := 'pending'; new.decided_at := null;
    select coalesce(sum(xp), 0) into earned from public.xp_events where user_id = new.user_id;
    select coalesce(sum(xp_cost), 0) into spent from public.redemptions where user_id = new.user_id and status <> 'rejected';
    if earned - spent < new.xp_cost then raise exception 'not enough XP (% available, % needed)', earned - spent, new.xp_cost; end if;
    select reward_pool_monthly into pool from public.orgs where id = new.org_id;
    select coalesce(sum(cost_inr), 0) into used from public.redemptions where org_id = new.org_id and status <> 'rejected' and date_trunc('month', created_at) = date_trunc('month', now());
    if used + new.cost_inr > coalesce(pool, 0) then raise exception 'this month''s reward pool is used up'; end if;
  else
    if new.xp_cost is distinct from old.xp_cost or new.cost_inr is distinct from old.cost_inr or new.user_id is distinct from old.user_id or new.org_id is distinct from old.org_id then
      raise exception 'redemption terms cannot change';
    end if;
    if new.status is distinct from old.status then new.decided_at := now(); end if;
  end if;
  return new;
end $$;
create trigger redemptions_guard before insert or update on public.redemptions for each row execute function public.redemptions_guard();
