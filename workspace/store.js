// One interface, two backends: Supabase (signed-in) or localStorage (offline / not signed in).
import * as db from '../db/supabase.js';

const KEY = 'myf-workspace';
const load = () => JSON.parse(localStorage.getItem(KEY) || '{"entries":[],"profile":{}}');
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const local = {
  mode: 'local',
  async list() { return load().entries; },
  async add(e) { const d = load(); const row = { ...e, id: uid() }; d.entries.push(row); save(d); return row; },
  async update(id, patch) { const d = load(); Object.assign(d.entries.find((x) => x.id === id) || {}, patch); save(d); },
  async remove(id) { const d = load(); d.entries = d.entries.filter((x) => x.id !== id); save(d); },
  async getProfile() { return load().profile; },
  async setProfile(p) { const d = load(); d.profile = p; save(d); },
};

export function remote(sb) {
  const t = (n) => sb.from(n);
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  return {
    mode: 'cloud',
    async list() { return ok(await t('entries').select('*').order('date', { ascending: false })); },
    async add(e) { return ok(await t('entries').insert(e).select().single()); },
    async update(id, patch) { ok(await t('entries').update(patch).eq('id', id)); },
    async remove(id) { ok(await t('entries').delete().eq('id', id)); },
    async getProfile() { return ok(await t('business_profiles').select('*').maybeSingle()) || {}; },
    async setProfile(p) { ok(await t('business_profiles').upsert({ name: p.name, gstin: p.gstin, opening_balance: p.opening_balance, updated_at: new Date().toISOString() })); },
  };
}

// First sign-in: move any offline data into the cloud once, then clear it.
export async function migrateLocal(cloud) {
  const d = load();
  if (!d.entries.length || (await cloud.list()).length) return 0;
  for (const { id, ...e } of d.entries) await cloud.add(e);
  if (d.profile?.name || d.profile?.gstin) await cloud.setProfile(d.profile);
  save({ entries: [], profile: {} });
  return d.entries.length;
}

export const pick = async () => {
  const sb = db.client();
  if (!sb) return local;
  const { data } = await sb.auth.getUser();
  return data?.user && !data.user.is_anonymous ? remote(sb) : local;
};
