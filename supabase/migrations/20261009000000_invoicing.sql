-- Invoicing: GST tax invoices / bills of supply, item catalog, e-way bill data, and invoices received from other organisations.
-- Issued invoices are immutable (GST rule): only status (cancel), sharing, e-way and buyer-response fields can change.

alter table public.orgs add column if not exists invoice_settings jsonb not null default '{}'::jsonb;  -- address, bank, UPI, prefix, terms
alter table public.parties add column if not exists address text, add column if not exists pincode text;
alter table public.entries add column if not exists invoice_id uuid;                                   -- sale/purchase rows created from an invoice
create index if not exists entries_invoice_idx on public.entries (invoice_id) where invoice_id is not null;

-- One workspace per GSTIN (first claim wins). Stops casual squatting; GSTIN ownership itself is NOT verified.
create unique index if not exists orgs_gstin_key on public.orgs (upper(gstin)) where gstin is not null;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  number text not null check (number ~ '^[A-Za-z0-9/-]{1,16}$'),
  doc_type text not null default 'tax' check (doc_type in ('tax','bos')),
  status text not null default 'draft' check (status in ('draft','issued','cancelled')),
  date date not null,
  due_date date,
  seller jsonb not null default '{}'::jsonb,
  buyer jsonb not null default '{}'::jsonb,
  buyer_gstin text,
  supply text not null default 'intra' check (supply in ('intra','inter')),
  pos_state text,
  reverse_charge boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  notes text,
  eway jsonb,
  shared boolean not null default false,
  buyer_status text check (buyer_status in ('pending','accepted','rejected')),
  buyer_note text,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, number)
);
create index on public.invoices (org_id, date desc);
create index on public.invoices (upper(buyer_gstin)) where shared;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  name text not null, hsn text, unit text not null default 'NOS',
  rate numeric not null default 0 check (rate >= 0),
  gst numeric not null default 18 check (gst in (0,5,12,18,28,40)),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index on public.items (org_id);

-- Is the caller a member of a workspace registered under this GSTIN? (SECURITY DEFINER: no policy recursion.)
create or replace function public.is_buyer(p_gstin text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.org_members m join public.orgs o on o.id = m.org_id
  where m.user_id = (select auth.uid()) and m.role in ('admin','finance') and upper(o.gstin) = upper(p_gstin)) $$;
revoke execute on function public.is_buyer(text) from public, anon;
grant execute on function public.is_buyer(text) to authenticated;

alter table public.invoices enable row level security;
alter table public.items enable row level security;

create policy "org read invoices" on public.invoices for select to authenticated using (public.org_role(org_id) is not null);
create policy "buyer reads shared invoice" on public.invoices for select to authenticated
  using (shared and status = 'issued' and buyer_gstin is not null and public.is_buyer(buyer_gstin));
create policy "org write invoices" on public.invoices for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org update invoices" on public.invoices for update to authenticated
  using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "org delete draft invoices" on public.invoices for delete to authenticated
  using (status = 'draft' and public.org_role(org_id) in ('admin','finance'));

create policy "org read items" on public.items for select to authenticated using (public.org_role(org_id) is not null);
create policy "org write items" on public.items for insert to authenticated with check (public.org_role(org_id) in ('admin','finance'));
create policy "org update items" on public.items for update to authenticated
  using (public.org_role(org_id) in ('admin','finance')) with check (public.org_role(org_id) in ('admin','finance'));
create policy "org delete items" on public.items for delete to authenticated using (public.org_role(org_id) in ('admin','finance'));

-- Issued invoices cannot be edited, only cancelled / shared / given e-way data / answered by the buyer.
create or replace function public.invoices_lock()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.status = 'issued' then new.buyer_status := case when new.shared then 'pending' else null end; end if;
    return new;
  end if;
  if old.status <> 'draft' and (
       new.number is distinct from old.number or new.date is distinct from old.date or new.items is distinct from old.items
       or new.totals is distinct from old.totals or new.seller is distinct from old.seller or new.buyer is distinct from old.buyer
       or new.supply is distinct from old.supply or new.doc_type is distinct from old.doc_type or new.org_id is distinct from old.org_id) then
    raise exception 'an issued invoice cannot be edited; cancel it and issue a new one';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'a cancelled invoice cannot be reopened'; end if;
  if old.status = 'issued' and new.status = 'draft' then raise exception 'an issued invoice cannot go back to draft'; end if;
  if new.shared and not old.shared and new.status = 'issued' then new.buyer_status := 'pending'; end if;
  return new;
end $$;
create trigger invoices_lock before insert or update on public.invoices for each row execute function public.invoices_lock();

-- The buyer accepts or rejects an invoice shared with them. Their own books are updated by their client (purchase entries).
create or replace function public.respond_invoice(p_id uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v public.invoices;
begin
  select * into v from public.invoices where id = p_id and shared and status = 'issued';
  if not found or not public.is_buyer(v.buyer_gstin) then raise exception 'invoice not found'; end if;
  update public.invoices set buyer_status = case when p_accept then 'accepted' else 'rejected' end, buyer_note = nullif(trim(coalesce(p_note, '')), '') where id = p_id;
end $$;
revoke execute on function public.respond_invoice(uuid, boolean, text) from public, anon;
grant execute on function public.respond_invoice(uuid, boolean, text) to authenticated;
