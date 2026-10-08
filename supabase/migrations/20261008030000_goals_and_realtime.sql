-- Monthly collection goal (dashboard goal ring) + realtime sync across devices.
alter table public.business_profiles
  add column if not exists monthly_goal numeric not null default 0 check (monthly_goal >= 0);

do $$
declare t text;
begin
  foreach t in array array['entries', 'xp_events', 'filings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
