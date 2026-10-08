import * as db from '../db/supabase.js';
import { getSession, openWorkspace, createOrg, joinOrg } from './repo.js';
import { summarize, enrich, filingDue, prevMonth, addDays, daysBetween } from '../workspace/calc.js';
import { makeCtx, BADGES, XP, levelOf } from './gamify.js';
import { createLedger } from '../ledger/blackbox.js';
import { makeGstin, validGstin } from '../tax/gst.js';
import { today, h, toast, $, inr } from './util.js';
import { VIEWS, reminderText } from './views.js';
import * as V2 from './views2.js';
import { invoiceHtml } from './invoice.js';
import { countUp, muted, setMuted } from './fx.js';
import { dueMonths } from './recurring.js';

const S = { recurring: [], parties: [], members: [], allRows: [], orgLog: [], repo: null, user: null, profile: {}, entries: [], filings: [], events: [], badges: [], ledger: null, sum: null, ctx: null, xp: 0, level: null, alerts: [], filingsView: [] };
const ALL = { ...VIEWS, parties: V2.parties, approvals: V2.approvals, reports: V2.reports, team: V2.team, styleguide: V2.styleguide };
const TITLES = { dashboard: 'Dashboard', transactions: 'Transactions', parties: 'Customers & vendors', approvals: 'Approvals', compliance: 'GST & Compliance', reports: 'Reports', insights: 'Insights', rewards: 'Team rewards', audit: 'Audit trail', team: 'Team & access', settings: 'Settings', styleguide: 'Style guide' };
let view = location.hash.slice(1) || 'dashboard', booted = false, session = null;

// Role permissions. viewer: read · finance: write · admin: everything.
S.can = (act) => { const r = S.repo?.role; return act === 'write' ? r === 'admin' || r === 'finance' : act === 'admin' ? r === 'admin' : true; };
const need = (act) => S.can(act) || (toast('Not allowed', `Your role (${S.repo.role}) cannot do this.`, 'bad'), false);

// ---- derived state -------------------------------------------------------
function compute() {
  const t = today();
  S.allRows = S.entries.map(enrich);
  S.sum = summarize(S.entries.filter((e) => (e.approval || 'approved') === 'approved'), S.profile, t);
  S.xp = S.events.reduce((a, e) => a + e.xp, 0);
  S.level = levelOf(S.xp);
  const cur = t.slice(0, 7), first = S.entries.map((e) => e.date.slice(0, 7)).sort()[0] || cur;
  S.filingsView = [];
  for (let i = 0; i < 4; i++) {
    const period = prevMonth(cur, i);
    if (period < first && i > 0) continue;
    for (const type of ['GSTR1', 'GSTR3B']) {
      const saved = S.filings.find((f) => f.type === type && f.period === period), due = filingDue(type, period);
      S.filingsView.push({ type, period, due_date: due, saved, status: saved ? (saved.filed_date <= due ? 'filed' : 'late') : due < t ? 'overdue' : 'upcoming' });
    }
  }
  const fa = S.filingsView.filter((f) => !f.saved && daysBetween(t, f.due_date) <= 5 && daysBetween(f.due_date, t) <= 30)
    .map((f) => ({ sev: f.status === 'overdue' || daysBetween(t, f.due_date) <= 2 ? 'high' : 'med', type: 'filing', text: `${f.type === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'} for ${f.period} ${f.status === 'overdue' ? `is overdue (was due ${f.due_date})` : `is due ${f.due_date}`}.` }));
  const pend = S.allRows.filter((r) => r.approval === 'pending').length;
  const ap = pend && S.can('admin') ? [{ sev: 'med', type: 'approval', text: `${pend} entr${pend === 1 ? 'y is' : 'ies are'} waiting for your approval.` }] : [];
  S.alerts = [...S.sum.alerts, ...fa, ...ap].sort((a, b) => ({ high: 0, med: 1 }[a.sev] - { high: 0, med: 1 }[b.sev]));
  S.ctx = makeCtx({ events: S.events, entries: S.entries, filings: S.filings, profile: S.profile, sum: S.sum, today: t });
}

async function load() {
  const r = S.repo;
  [S.entries, S.filings, S.events, S.badges, S.recurring, S.parties] = await Promise.all([r.list('entries', { col: 'date', asc: false }), r.list('filings'), r.list('xp_events'), r.list('badges'), r.list('recurring'), r.list('parties', { col: 'name', asc: true })]);
  S.profile = await r.getProfile();
  S.members = await r.members().catch(() => []);
  const log = await r.list('activity_log', { col: 'n', asc: true });
  S.orgLog = log;
  const mine = log.filter((x) => x.user_id === r.userId || r.mode === 'demo').sort((a, b) => a.n - b.n);
  S.ledger = createLedger(null, mine.map((x) => ({ n: x.n, day: x.day, agent: x.agent, cardId: x.ref, decision: x.decision, why: x.why, prevHash: x.prev_hash, hash: x.hash })));
  compute();
}

// ---- gamification + audit ---------------------------------------------------
async function award(kind, ref, xp, label) {
  const row = await S.repo.insert('xp_events', { kind, ref: String(ref), day: today(), xp });
  if (!row) return false;
  const before = S.level.n; S.events.push(row); compute();
  toast(`+${xp} XP`, label, 'xp');
  if (S.level.n > before) toast('Level up', `You are now ${S.level.name}`, 'lvl');
  return true;
}
async function checkBadges() {
  const have = new Set(S.badges.map((b) => b.code));
  for (const b of BADGES) if (!have.has(b.code) && b.test(S.ctx)) {
    const row = await S.repo.insert('badges', { code: b.code });
    if (row) { S.badges.push(row); toast('Badge unlocked', b.title, 'lvl'); await award('badge', b.code, XP.badge, `Badge: ${b.title}`); }
  }
}
const who = () => S.repo.displayName || (S.user.email || 'user').split('@')[0];
async function audit(action, ref, detail, why) {
  const e = await S.ledger.append({ day: today(), agent: who(), cardId: ref ?? null, decision: { action, ...detail }, why });
  try { await S.repo.insert('activity_log', { n: e.n, day: e.day, agent: e.agent, ref: e.cardId, decision: e.decision, why: e.why, prev_hash: e.prevHash, hash: e.hash }); } catch (x) { console.warn('audit not saved', x.message); }
}
async function refresh() { compute(); await checkBadges(); render(); }

// ---- actions ---------------------------------------------------------------
const find = (id) => S.entries.find((e) => e.id === id);
const phoneDigits = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };
const A = {
  render: () => render(), go: (v) => { location.hash = v; }, audit, award,
  leaderboard: () => S.repo.leaderboard().catch(() => []),
  async addEntry(e) {
    if (!need('write')) return;
    if (e.kind === 'salary') e.gst_rate = 0;
    const row = await S.repo.insert('entries', e); S.entries.unshift(row);
    const t = Math.round((e.taxable * (100 + e.gst_rate)) / 100), pending = row.approval === 'pending';
    await audit('entry.add', row.id, { kind: e.kind, party: e.party, total: t, approval: row.approval || 'approved' }, `Recorded ${e.kind} "${e.number || 'no ref'}" with ${e.party} for ${inr(t)} (GST ${e.gst_rate}%).${pending ? ` Above the ${inr(S.profile.approval_limit)} limit: sent for admin approval.` : ''}`);
    if (pending) toast('Sent for approval', `${inr(t)} is above the ${inr(S.profile.approval_limit)} limit`);
    compute(); await award('entry_added', row.id, XP.entry_added, 'Transaction logged');
    await refresh();
  },
  async markPaid(id, date = today(), batch = false) {
    if (!need('write')) return;
    const r = find(id), t = date, onTime = !r.due_date || t <= r.due_date, wasAlert = S.alerts.some((a) => a.id === id);
    await S.repo.update('entries', id, { paid_date: t }); r.paid_date = t; compute();
    await audit('entry.paid', id, { party: r.party, onTime }, `Marked ${r.kind} "${r.number || ''}" with ${r.party} as paid on ${t}. ${onTime ? 'On time.' : `Late by ${daysBetween(r.due_date, t)} day(s).`}`);
    if (onTime) await award('paid_on_time', id, XP.paid_on_time, 'Paid on time');
    if (wasAlert) await award('alert_resolved', id + ':paid', XP.alert_resolved, 'Alert resolved');
    if (!batch) await refresh();
  },
  async reminder(id) {
    const r = find(id), total = Math.round((r.taxable * (100 + r.gst_rate)) / 100), text = reminderText(S, { ...r, total }), party = S.parties.find((p) => p.name === r.party);
    try { await navigator.clipboard.writeText(text); toast('Reminder copied', party?.phone ? 'Opening WhatsApp…' : 'Paste it into WhatsApp or email.'); } catch { if (!party?.phone) prompt('Copy this reminder:', text); }
    if (party?.phone) window.open(`https://wa.me/${phoneDigits(party.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    else if (party?.email) window.open(`mailto:${party.email}?subject=${encodeURIComponent('Payment reminder: ' + (r.number || ''))}&body=${encodeURIComponent(text)}`);
    await audit('reminder.send', id, { party: r.party, via: party?.phone ? 'whatsapp' : party?.email ? 'email' : 'copy' }, `Prepared a payment reminder for ${r.party} (invoice ${r.number || 'n/a'}, due ${r.due_date}).`);
    await award('alert_resolved', id + ':remind', XP.alert_resolved, 'Reminder prepared'); await refresh();
  },
  printInvoice(id) {
    const r = S.allRows.find((x) => x.id === id), w = window.open('', '_blank');
    if (!w) return toast('Pop-up blocked', 'Allow pop-ups to print invoices.', 'bad');
    w.document.write(invoiceHtml(r, S.profile, S.parties.find((p) => p.name === r.party))); w.document.close();
    audit('invoice.print', id, { party: r.party }, `Opened invoice ${r.number || ''} for ${r.party} for printing.`);
  },
  async reconcile(pairs) {
    if (!need('write')) return;
    for (const [id, date] of pairs) await A.markPaid(id, date, true);
    await audit('bank.reconcile', null, { matched: pairs.length }, `Reconciled ${pairs.length} bank transaction(s) against open invoices and bills from an imported statement.`);
    toast('Reconciled', `${pairs.length} transaction(s) marked paid`); await refresh();
  },
  async addRecurring(tpl) {
    if (!need('write')) return;
    const row = await S.repo.insert('recurring', { ...tpl, start_month: today().slice(0, 7), last_generated: null, active: true }); S.recurring.push(row);
    await audit('recurring.add', row.id, { party: tpl.party, kind: tpl.kind }, `Created a monthly recurring ${tpl.kind} for ${tpl.party} (${inr(tpl.taxable)} on day ${tpl.day_of_month}).`);
    await generateRecurring(); await refresh();
  },
  async removeRecurring(id) {
    if (!need('write')) return;
    await audit('recurring.delete', id, {}, 'Stopped a recurring entry template.');
    await S.repo.remove('recurring', id); S.recurring = S.recurring.filter((r) => r.id !== id); await refresh();
  },
  async remove(id) {
    if (!need('admin')) return;
    const r = find(id);
    await audit('entry.delete', id, { party: r.party, kind: r.kind }, `Deleted ${r.kind} "${r.number || ''}" with ${r.party} dated ${r.date}.`);
    await S.repo.remove('entries', id); S.entries = S.entries.filter((e) => e.id !== id); await refresh();
  },
  async decide(id, ok, note = '') {
    if (!need('admin')) return;
    const r = find(id), approval = ok ? 'approved' : 'rejected';
    await S.repo.update('entries', id, { approval, approval_note: note || null }); Object.assign(r, { approval, approval_note: note || null });
    await audit(ok ? 'entry.approve' : 'entry.reject', id, { party: r.party }, `${ok ? 'Approved' : 'Rejected'} ${r.kind} "${r.number || ''}" with ${r.party}${note ? `: ${note}` : ''}.`);
    toast(ok ? 'Approved' : 'Rejected', r.party); await refresh();
  },
  async addParty(p) {
    if (!need('write')) return;
    const row = await S.repo.insert('parties', p);
    if (!row) return toast('Already exists', `${p.name} is already in your directory`, 'bad');
    S.parties.push(row); S.parties.sort((a, b) => a.name.localeCompare(b.name));
    await audit('party.add', row.id, { name: p.name, kind: p.kind }, `Added ${p.kind} ${p.name} to the directory.`); await refresh();
  },
  async removeParty(id) {
    if (!need('admin')) return;
    const p = S.parties.find((x) => x.id === id);
    await audit('party.delete', id, { name: p.name }, `Removed ${p.kind} ${p.name} from the directory.`);
    await S.repo.remove('parties', id); S.parties = S.parties.filter((x) => x.id !== id); await refresh();
  },
  async file(type, period, due, amount) {
    if (!need('write')) return;
    const t = today(), onTime = t <= due, row = await S.repo.insert('filings', { type, period, due_date: due, filed_date: t, amount });
    if (!row) return toast('Already recorded', `${type} ${period}`);
    S.filings.push(row); compute();
    await audit('filing.mark', row.id, { type, period, onTime }, `Recorded ${type} for ${period} as filed on ${t} (due ${due}${amount ? `, tax paid ${inr(amount)}` : ''}). ${onTime ? 'On time.' : 'Filed late: interest and late fee may apply.'}`);
    if (onTime) await award('filing_on_time', `${type}:${period}`, XP.filing_on_time, 'Return filed on time');
    await award('alert_resolved', `file:${type}:${period}`, XP.alert_resolved, 'Compliance alert resolved'); await refresh();
  },
  async saveProfile(p) {
    const orgKeys = ['name', 'gstin', 'opening_balance', 'monthly_goal', 'approval_limit'];
    if (!S.can('admin')) { for (const k of orgKeys) delete p[k]; }
    else if (Object.keys(p).some((k) => orgKeys.includes(k)) === false) { /* personal only */ }
    await S.repo.saveProfile({ ...p, health: S.sum.health }); S.profile = { ...S.profile, ...p };
    await audit('profile.save', null, { keys: Object.keys(p).join(',') }, 'Updated settings.');
    if (S.profile.name && validGstin(S.profile.gstin)) await award('profile_complete', 'once', XP.profile_complete, 'Company profile completed');
    toast('Saved', 'Settings updated.'); await refresh();
  },
  async setRole(userId, role) {
    if (!need('admin')) return;
    try { await S.repo.setRole(userId, role); } catch (x) { toast('Could not change role', x.message, 'bad'); return load().then(render); }
    await audit('team.role', userId, { role }, `Changed a team member's role to ${role}.`); await load(); await refresh();
  },
  async removeMember(userId) {
    if (!need('admin')) return;
    try { await S.repo.removeMember(userId); } catch (x) { return toast('Could not remove', x.message, 'bad'); }
    await audit('team.remove', userId, {}, 'Removed a member from the workspace.'); await load(); await refresh();
  },
  demoRole(role) { S.repo.setDemoRole(role); location.reload(); },
  async demo() {
    if (!need('write')) return;
    const t = today(), g = (s, pan) => makeGstin(s, pan), own = validGstin(S.profile.gstin) ? S.profile.gstin : null, st = own ? own.slice(0, 2) : '27';
    const rows = [
      ['sale', 'INV-101', 'Sharma Traders', g(st, 'AAPFS0939F'), -75, -60, 48000, 18, 'intra', -58], ['sale', 'INV-102', 'Bluebird Retail', g('29', 'AABCB4521K'), -62, -47, 82000, 18, 'inter', -40],
      ['sale', 'INV-103', 'Kaveri Foods', g('33', 'AAACK7788L'), -41, -26, 36000, 18, 'inter', -20], ['sale', 'INV-104', 'Sharma Traders', g(st, 'AAPFS0939F'), -33, -18, 61000, 18, 'intra', -15],
      ['sale', 'INV-105', 'Bluebird Retail', g('29', 'AABCB4521K'), -20, -5, 94000, 18, 'inter', null], ['sale', 'INV-106', 'Kaveri Foods', g('33', 'AAACK7788L'), -6, 9, 27000, 18, 'inter', null],
      ['purchase', 'B-77', 'Apex Machinery', g(st, 'AAECA5566M'), -55, -40, 52000, 18, 'intra', -38], ['purchase', 'B-81', 'Metro Packaging', g(st, 'AAGCM2190B'), -28, -13, 31000, 18, 'intra', -12],
      ['purchase', 'B-90', 'QuickPrint (no GSTIN)', null, -9, 6, 14000, 18, 'intra', null], ['purchase', 'B-91', 'Apex Machinery', g(st, 'AAECA5566M'), -3, 12, 44000, 18, 'intra', null],
      ['expense', 'RENT-OCT', 'City Properties', null, -7, -2, 25000, 0, 'intra', -2], ['expense', 'SW-221', 'CloudBooks SaaS', g('29', 'AABCC8899K'), -15, -15, 4200, 18, 'inter', -15],
      ['salary', 'PAY-SEP', 'Team payroll', null, -38, -35, 90000, 0, 'intra', -35], ['salary', 'PAY-OCT', 'Team payroll', null, -8, -5, 90000, 0, 'intra', null],
    ];
    for (const [kind, number, party, gstin, d, du, taxable, gst_rate, supply, pd] of rows)
      S.entries.unshift(await S.repo.insert('entries', { kind, number, party, gstin, date: addDays(t, d), due_date: addDays(t, du), taxable, gst_rate, supply, paid_date: pd == null ? null : addDays(t, pd), category: kind === 'expense' ? 'Operations' : null }));
    for (const [kind, name, gstin, phone, email] of [['customer', 'Sharma Traders', g(st, 'AAPFS0939F'), '9876543210', 'accounts@sharma.example'], ['customer', 'Bluebird Retail', g('29', 'AABCB4521K'), '9812345678', null], ['customer', 'Kaveri Foods', g('33', 'AAACK7788L'), null, 'pay@kaveri.example'], ['vendor', 'Apex Machinery', g(st, 'AAECA5566M'), null, null], ['vendor', 'Metro Packaging', g(st, 'AAGCM2190B'), null, null]]) {
      const p = await S.repo.insert('parties', { kind, name, gstin, phone, email, notes: null }); if (p) S.parties.push(p);
    }
    if (!S.profile.opening_balance && S.can('admin')) { await S.repo.saveProfile({ opening_balance: 150000 }); S.profile.opening_balance = 150000; }
    await audit('demo.load', null, { rows: rows.length }, 'Loaded sample data to explore the app.');
    toast('Sample data loaded', `${rows.length} transactions added`); await refresh(); A.go('dashboard');
  },
  async signOut() { await db.signOut(); S.repo?.reset?.(); location.hash = ''; location.reload(); },
};

// Creates the monthly entries for recurring templates that are due (idempotent via last_generated).
async function generateRecurring() {
  if (!S.can('write')) return;
  let made = 0;
  for (const tpl of S.recurring.filter((r) => r.active)) {
    const months = dueMonths(tpl, today());
    for (const { month, date } of months) {
      const row = await S.repo.insert('entries', { kind: tpl.kind, number: `REC-${month}`, party: tpl.party, gstin: tpl.gstin || null, category: tpl.category || null, date, due_date: date, taxable: tpl.taxable, gst_rate: tpl.gst_rate, supply: 'intra', paid_date: null });
      S.entries.unshift(row); made++;
    }
    if (months.length) { const last = months[months.length - 1].month; await S.repo.update('recurring', tpl.id, { last_generated: last }); tpl.last_generated = last; }
  }
  if (made) { await audit('recurring.generate', null, { entries: made }, `Created ${made} entr${made === 1 ? 'y' : 'ies'} from recurring templates.`); toast('Recurring entries', `${made} added automatically`); compute(); }
}

// ---- chrome / render ---------------------------------------------------------
function chrome() {
  $('#lv-name').textContent = `Lv ${S.level.n} · ${S.level.name}`; $('#lv-xp').textContent = `${S.xp} XP`; $('#lv-bar').style.width = S.level.pct + '%';
  $('#streak').textContent = `${S.ctx.streak}-day streak`; $('#who').textContent = `${who()} · ${S.repo.role}`; $('#org').textContent = S.profile.name || 'Oxro Labs';
  $('#mode').textContent = S.repo.mode === 'cloud' ? 'Synced' : 'Demo'; $('#mode').className = 'pill ' + (S.repo.mode === 'cloud' ? '' : 'warn');
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.v === view));
  document.querySelectorAll('[data-role]').forEach((a) => { a.hidden = !S.can(a.dataset.role); });
  const open = S.alerts.filter((a) => a.sev === 'high').length; $('#nav-n').textContent = open || ''; $('#nav-n').hidden = !open;
  const ap = S.allRows.filter((r) => r.approval === 'pending').length; $('#nav-ap').textContent = ap || ''; $('#nav-ap').hidden = !ap;
}
function render() {
  if (!S.sum) return;
  if (view === 'team' && !S.can('admin')) { view = 'dashboard'; location.hash = 'dashboard'; }
  chrome();
  const root = $('#view'); root.textContent = '';
  root.append(h('h2', {}, TITLES[view] || ''), (ALL[view] || ALL.dashboard)(S, A));
  countUp(root);
}
window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'dashboard'; render(); });

// ---- auth + workspace setup + boot ---------------------------------------------
function modal(...kids) { const box = $('#auth'); box.hidden = false; $('#app').hidden = true; const m = box.querySelector('.modal'); m.textContent = ''; m.append(h('span', { class: 'logo big' }, h('img', { src: 'public/logo.png', alt: '' })), ...kids); }
const run = (msg, fn) => async () => { msg.textContent = 'Working…'; try { await fn(); } catch (x) { msg.textContent = x.message; } };

const TERMS_VERSION = '2026-10-08';
function legalLinks() { return h('p', { class: 'legal-links' }, h('a', { href: 'legal/terms.html', target: '_blank', rel: 'noopener' }, 'Terms'), ' · ', h('a', { href: 'legal/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy'), ' · ', h('a', { href: 'legal/disclaimer.html', target: '_blank', rel: 'noopener' }, 'Disclaimer'), ' · ', h('a', { href: 'welcome.html', target: '_blank', rel: 'noopener' }, 'About')); }

function authScreen() {
  const sb = db.client(), email = h('input', { type: 'email', placeholder: 'you@oxrolabs.com', autocomplete: 'email', 'aria-label': 'Work email' }), pw = h('input', { type: 'password', placeholder: 'Password (min 6 characters)', autocomplete: 'current-password', 'aria-label': 'Password' }), msg = h('p', { class: 'mu small', role: 'status', 'aria-live': 'polite' });
  const agree = h('input', { type: 'checkbox', id: 'agree' });
  const needConsent = () => { if (!agree.checked) throw new Error('Please accept the Terms and Privacy notice to create an account.'); };
  const meta = () => ({ options: { data: { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } } });
  modal(h('h2', {}, 'Oxro Labs · Finance Desk'), h('p', { class: 'mu' }, 'Invoices, GST, approvals and cash flow for the whole team. Sign in with your company email.'),
    ...(sb ? [email, pw,
      h('label', { class: 'consent', for: 'agree' }, agree, h('span', {}, 'I agree to the ', h('a', { href: 'legal/terms.html', target: '_blank', rel: 'noopener' }, 'Terms of Service'), ' and have read the ', h('a', { href: 'legal/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy Notice'), '. I understand figures are planning estimates, not tax advice. (Needed to create an account.)')),
      h('div', { class: 'row' },
      h('button', { class: 'pri', onclick: run(msg, async () => { const { error } = await sb.auth.signInWithPassword({ email: email.value, password: pw.value }); if (error) throw error; boot(); }) }, 'Sign in'),
      h('button', { onclick: run(msg, async () => { needConsent(); const { data, error } = await sb.auth.signUp({ email: email.value, password: pw.value, ...meta() }); if (error) throw error; if (data.session) boot(); else msg.textContent = 'Account created. Check your email to confirm, then sign in.'; }) }, 'Create account'),
      h('button', { onclick: run(msg, async () => { needConsent(); await db.signInEmail(email.value); msg.textContent = 'Check your inbox for the sign-in link.'; }) }, 'Email me a link'))]
      : [h('p', { class: 'al med' }, 'Cloud database is not configured. Set SUPABASE_ANON_KEY in .env and run npm run sync-env.')]),
    msg, h('hr'), h('button', { onclick: () => boot(true) }, 'Continue in demo mode'), h('p', { class: 'small mu' }, 'Demo mode keeps data in this browser only.'), legalLinks());
}

function orgScreen() {
  const sb = session.sb, em = session.user.email || '', domain = em.split('@')[1] || '';
  const [name, you, dom, code, you2] = [h('input', { value: 'Oxro Labs' }), h('input', { placeholder: 'Your name' }), h('input', { value: domain, placeholder: 'oxrolabs.com' }), h('input', { placeholder: 'Invite code' }), h('input', { placeholder: 'Your name' })], m1 = h('p', { class: 'mu small' }), m2 = h('p', { class: 'mu small' });
  modal(h('h2', {}, 'Set up your workspace'), h('p', { class: 'mu' }, `Signed in as ${em}. Create the company workspace, or join your team with an invite code.`),
    h('h3', {}, 'Create a workspace (you become admin)'), name, you, h('label', { class: 'small mu' }, 'Only allow emails from this domain'), dom,
    h('button', { class: 'pri', onclick: run(m1, async () => { await createOrg(sb, name.value, you.value || em.split('@')[0], dom.value); boot(); }) }, 'Create workspace'), m1,
    h('hr'), h('h3', {}, 'Or join an existing team'), code, you2, h('button', { onclick: run(m2, async () => { await joinOrg(sb, code.value, you2.value || em.split('@')[0]); boot(); }) }, 'Join with code'), m2,
    h('hr'), h('button', { onclick: A.signOut }, 'Sign out'), legalLinks());
}

async function boot(allowDemo = false) {
  if (!booted) { booted = true; await db.init(false); db.client()?.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' && !S.repo) boot(); }); }
  session = await getSession(allowDemo);
  if (!session) return authScreen();
  let ws; try { ws = await openWorkspace(session); } catch (x) { return dbError(x); }
  if (ws.needsOrg) return orgScreen();
  S.repo = ws.repo; S.user = session.user;
  try { await load(); } catch (x) { return dbError(x); }
  $('#auth').hidden = true; $('#app').hidden = false;
  try { await generateRecurring(); } catch (x) { console.warn('recurring', x.message); }
  if (await award('checkin', today(), XP.checkin, 'Daily check-in')) toast('Welcome back', `${S.ctx.streak}-day streak`);
  await checkBadges(); render(); live();
  if (S.repo.mode === 'cloud' && S.profile.leaderboard_opt_in && S.profile.health !== S.sum.health) S.repo.saveProfile({ health: S.sum.health }).catch(() => {});
}
function dbError(x) {
  console.error(x);
  modal(h('h2', {}, 'Database not ready'), h('p', { class: 'al high' }, x.message), h('p', { class: 'mu' }, 'Apply the migrations in supabase/migrations (npx supabase db push), then reload.'), h('button', { onclick: () => location.reload() }, 'Reload'), h('button', { onclick: A.signOut }, 'Sign out'));
}

// Live updates: teammates changing data refresh this screen; the date rolling over starts a new day.
let liveOn = false, debounce, day0 = today();
function live() {
  if (liveOn) return; liveOn = true;
  const sb = db.client();
  if (sb && S.repo.mode === 'cloud') {
    const ch = sb.channel('myf-live');
    for (const table of ['entries', 'filings', 'xp_events', 'parties']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => { clearTimeout(debounce); debounce = setTimeout(async () => { await load(); await refresh(); }, 400); });
    ch.subscribe();
  }
  setInterval(async () => { if (today() !== day0) { day0 = today(); if (await award('checkin', day0, XP.checkin, 'New day: daily check-in')) toast('New day', `${S.ctx.streak}-day streak`); await refresh(); } }, 60000);
}
$('#signout').onclick = () => A.signOut();
$('#snd').textContent = muted() ? 'Sound off' : 'Sound on';
$('#snd').onclick = () => { setMuted(!muted()); $('#snd').textContent = muted() ? 'Sound off' : 'Sound on'; };
boot();
