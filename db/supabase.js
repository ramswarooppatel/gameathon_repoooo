// Supabase is optional: every call no-ops if config.js is empty or the network fails.
import { CONFIG } from '../config.js';

let sb = null, runId = null, queue = Promise.resolve();
const warn = (e) => console.warn('[supabase]', e?.message || e);

export const enabled = () => !!sb;

export const client = () => sb;
export async function signInEmail(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw error;
}
export const signOut = () => sb?.auth.signOut();

// anonymous=true for the game (frictionless); the business workspace needs real email sign-in.
export async function init(anonymous = true) {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return false;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    if (anonymous && !(await sb.auth.getSession()).data.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
    }
    return true;
  } catch (e) { warn(e); sb = null; return false; }
}

export async function startRun(seed, nickname) {
  runId = null;
  if (!sb) return;
  const { data, error } = await sb.from('runs').insert({ seed, nickname }).select('id').single();
  if (error) return warn(error);
  runId = data.id;
}

// Serialised so ledger rows land in order.
export function pushLedger(e) {
  if (!sb || !runId) return;
  const row = { run_id: runId, n: e.n, day: e.day, agent: e.agent, card_id: e.cardId, decision: e.decision, why: e.why, prev_hash: e.prevHash, hash: e.hash };
  queue = queue.then(async () => { const { error } = await sb.from('ledger_entries').insert(row); if (error) warn(error); });
}

export async function finishRun(r) {
  if (!sb || !runId) return;
  await queue;
  const { error } = await sb.from('runs').update(r).eq('id', runId);
  if (error) warn(error);
}

export async function leaderboard() {
  if (!sb) return [];
  const { data, error } = await sb.from('runs').select('nickname,stars,final_health,ghost_health,reaction_avg')
    .neq('status', 'playing').order('stars', { ascending: false }).order('final_health', { ascending: false }).limit(5);
  if (error) { warn(error); return []; }
  return data;
}
