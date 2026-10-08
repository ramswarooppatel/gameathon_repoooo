// Data layer. Cloud = Supabase (company workspace, RLS by org role). Demo = this browser only.
import * as db from '../db/supabase.js';

const UNIQUE = { xp_events: ['kind', 'ref'], badges: ['code'], filings: ['type', 'period'], parties: ['kind', 'name'], checklist_ticks: ['period', 'item'], items: ['name'], invoices: ['number'], rewards: ['name'] };
const ORG_TABLES = new Set(['entries', 'filings', 'recurring', 'parties', 'activity_log', 'checklist_ticks', 'invoices', 'items', 'rewards', 'redemptions']);
const ORG_KEYS = ['name', 'gstin', 'opening_balance', 'monthly_goal', 'approval_limit', 'budgets', 'invoice_settings', 'reward_pool_monthly'];
const KEY = 'myf-demo-data';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const DEFAULT_ORG = { name: 'Oxro Labs', gstin: null, opening_balance: 0, monthly_goal: 0, approval_limit: 25000, invite_code: 'demo0000' };

function demoRepo() {
  const load = () => { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); d.profile ||= {}; d.org ||= { ...DEFAULT_ORG }; d.role ||= 'admin'; return d; };
  const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
  const d0 = load();
  return {
    mode: 'demo', userId: 'me', role: d0.role, org: d0.org, displayName: 'You',
    async list(t, order) {
      const rows = load()[t] || [];
      return order ? [...rows].sort((a, b) => (a[order.col] > b[order.col] ? 1 : -1) * (order.asc ? 1 : -1)) : rows;
    },
    async insert(t, row) {
      const d = load(), rows = (d[t] ||= []);
      if (UNIQUE[t] && rows.some((r) => UNIQUE[t].every((k) => r[k] === row[k]))) return null;
      const full = { ...row, id: uid(), created_at: new Date().toISOString(), user_id: 'me' };
      if (t === 'entries') { full.approval = 'approved'; if (row.kind !== 'sale' && d.role !== 'admin' && row.taxable * (1 + row.gst_rate / 100) > d.org.approval_limit) full.approval = 'pending'; }
      if (t === 'redemptions') Object.assign(full, { status: 'pending', decided_at: null });      // DB defaults
      rows.push(full); save(d); return full;
    },
    async update(t, id, patch) { const d = load(); Object.assign((d[t] || []).find((r) => r.id === id) || {}, patch); save(d); },
    async remove(t, id) { const d = load(); d[t] = (d[t] || []).filter((r) => r.id !== id); save(d); },
    async getProfile() { const d = load(); return { ...d.org, ...d.profile }; },
    async saveProfile(p) { const d = load(); Object.assign(d.org, pick(p, ORG_KEYS)); Object.assign(d.profile, pick(p, ['nickname', 'leaderboard_opt_in', 'health'])); save(d); this.org = d.org; },
    async members() { const d = load(); return [{ user_id: 'me', display_name: 'You', role: d.role }]; },
    async setRole(_u, role) { const d = load(); d.role = role; save(d); },
    async removeMember() {},
    async leaderboard() { return []; },
    async inbox() { return []; },                                   // invoices other orgs shared with us (cloud only)
    async respond() {},
    setDemoRole(role) { const d = load(); d.role = role; save(d); },
    reset() { localStorage.removeItem(KEY); },
  };
}

function cloudRepo(sb, user, m) {
  const orgId = m.org.id, ok = ({ data, error }) => { if (error) throw error; return data; };
  const self = {
    mode: 'cloud', userId: user.id, role: m.role, org: m.org, displayName: m.display_name,
    async list(t, order) {
      let q = sb.from(t).select('*'); if (ORG_TABLES.has(t)) q = q.eq('org_id', orgId);
      if (order) q = q.order(order.col, { ascending: !!order.asc });
      return ok(await q);
    },
    async insert(t, row) {
      const { data, error } = await sb.from(t).insert(ORG_TABLES.has(t) ? { ...row, org_id: orgId } : row).select().maybeSingle();
      if (error) { if (error.code === '23505') return null; throw error; }
      return data;
    },
    async update(t, id, patch) { ok(await sb.from(t).update(patch).eq('id', id)); },
    async remove(t, id) { ok(await sb.from(t).delete().eq('id', id)); },
    async getProfile() {
      const org = ok(await sb.from('orgs').select('*').eq('id', orgId).single()); self.org = org;
      const me = ok(await sb.from('business_profiles').select('*').maybeSingle()) || {};
      return { ...org, nickname: me.nickname, leaderboard_opt_in: me.leaderboard_opt_in, health: me.health };
    },
    async saveProfile(p) {
      const o = pick(p, ORG_KEYS), me = pick(p, ['nickname', 'leaderboard_opt_in', 'health']);
      if (Object.keys(o).length) ok(await sb.from('orgs').update(o).eq('id', orgId));
      if (Object.keys(me).length) ok(await sb.from('business_profiles').upsert({ ...me, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
    },
    async members() { return ok(await sb.from('org_members').select('user_id,role,display_name,created_at').eq('org_id', orgId)); },
    async setRole(userId, role) { ok(await sb.rpc('set_member_role', { p_org: orgId, p_user: userId, p_role: role })); },
    async removeMember(userId) { ok(await sb.rpc('remove_member', { p_org: orgId, p_user: userId })); },
    async leaderboard() { return ok(await sb.rpc('get_leaderboard')) || []; },
    async inbox() { return ok(await sb.from('invoices').select('*').eq('shared', true).neq('org_id', orgId).order('date', { ascending: false })); },
    async respond(id, accept, note) { ok(await sb.rpc('respond_invoice', { p_id: id, p_accept: accept, p_note: note || null })); },
  };
  return self;
}

// ---- session / workspace -----------------------------------------------------
export async function getSession(allowDemo) {
  const sb = db.client();
  if (sb) { const { data } = await sb.auth.getUser(); if (data?.user) return { mode: 'cloud', sb, user: data.user }; }
  return allowDemo ? { mode: 'demo', user: { email: 'demo mode (this browser only)' } } : null;
}

// Returns { repo } or { needsOrg: true } when the signed-in user has no company workspace yet.
export async function openWorkspace(s) {
  if (s.mode === 'demo') return { repo: demoRepo() };
  const { data, error } = await s.sb.from('org_members').select('role,display_name,orgs(*)').eq('user_id', s.user.id).limit(1);
  if (error) throw error;
  if (!data?.length) return { needsOrg: true };
  return { repo: cloudRepo(s.sb, s.user, { role: data[0].role, display_name: data[0].display_name, org: data[0].orgs }) };
}

export async function createOrg(sb, name, display, domain) {
  const { error } = await sb.rpc('create_org', { p_name: name, p_display: display, p_domain: domain || null }); if (error) throw error;
}
export async function joinOrg(sb, code, display) {
  const { error } = await sb.rpc('join_org', { p_code: code, p_display: display }); if (error) throw error;
}
