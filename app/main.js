import * as db from '../db/supabase.js';
import { getSession, openWorkspace, createOrg, joinOrg } from './repo.js';
import { summarize, enrich, filingDue, prevMonth, addDays, daysBetween } from '../workspace/calc.js';
import { makeCtx, BADGES, XP, levelOf } from './gamify.js';
import { createLedger } from '../ledger/blackbox.js';
import { makeGstin, validGstin } from '../tax/gst.js';
import { today, h, toast, $, inr } from './util.js';
import { VIEWS, reminderText, setTxQuery } from './views.js';
import { invoicePdf } from './pdf.js';
import * as V2 from './views2.js';
import * as V3 from './views3.js';
import { invoiceHtml, taxInvoiceHtml } from './invoice.js';
import * as V4 from './views4.js';
import * as V5 from './views5.js';
import * as V6 from './views6.js';
import { payslipPdf } from './payslip.js';
import { validateEmployee, buildRun, entriesFor, paidOnTime, payrollStreak, payrollReadiness, registerCsv, bankCsv, ecrText, monthName } from '../workspace/payroll.js';
import { countUp, muted, setMuted } from './fx.js';
import { iconSvg, icon } from './icons.js';
import { dueMonths } from './recurring.js';

const S = { employees: [], runs: [], payslips: [], rewards: [], redemptions: [], spendable: 0, invoices: [], items: [], inbox: [], ticks: [], recurring: [], parties: [], members: [], allRows: [], orgLog: [], repo: null, user: null, profile: {}, entries: [], filings: [], events: [], badges: [], ledger: null, sum: null, ctx: null, xp: 0, level: null, alerts: [], filingsView: [] };
const ALL = { ...VIEWS, parties: V2.parties, approvals: V2.approvals, reports: V2.reports, team: V2.team, styleguide: V2.styleguide, today: V3.workflow, planner: V3.planner, learn: V3.learn, invoices: V4.invoices, standards: V5.standards, payroll: V6.payroll };
ALL.rewards = (s, a) => V5.rewardsPage(s, a, VIEWS.rewards);
const TITLES = { payroll: 'Payroll', standards: 'Compliance', invoices: 'Invoices', today: 'Today', planner: 'Cash planner', learn: 'Learn', dashboard: 'Dashboard', transactions: 'Transactions', parties: 'Customers & vendors', approvals: 'Approvals', compliance: 'GST & Compliance', reports: 'Reports', insights: 'Insights', rewards: 'Team rewards', audit: 'Audit trail', team: 'Team & access', settings: 'Settings', styleguide: 'Style guide' };
let view = location.hash.slice(1) || 'today', booted = false, session = null;

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
  S.spendable = S.xp - S.redemptions.filter((x) => x.user_id === S.repo.userId && x.status !== 'rejected').reduce((a, x) => a + x.xp_cost, 0);
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
  S.ctx = makeCtx({ events: S.events, entries: S.entries, filings: S.filings, profile: S.profile, sum: S.sum, today: t, runs: S.runs });
}

async function load() {
  const r = S.repo;
  [S.entries, S.filings, S.events, S.badges, S.recurring, S.parties, S.ticks, S.invoices, S.items, S.inbox, S.rewards, S.redemptions, S.employees, S.runs, S.payslips] = await Promise.all([r.list('entries', { col: 'date', asc: false }), r.list('filings'), r.list('xp_events'), r.list('badges'), r.list('recurring'), r.list('parties', { col: 'name', asc: true }), r.list('checklist_ticks'), r.list('invoices', { col: 'date', asc: false }), r.list('items', { col: 'name', asc: true }), r.inbox().catch(() => []), r.list('rewards', { col: 'xp_cost', asc: true }), r.list('redemptions', { col: 'created_at', asc: false }), r.list('employees', { col: 'name', asc: true }).catch(() => []), r.list('payroll_runs', { col: 'period', asc: false }).catch(() => []), r.list('payslips').catch(() => [])]);
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
  async tick(period, item, on) {
    if (!need('write')) return;
    const cur = S.ticks.find((x) => x.period === period && x.item === item);
    if (on && !cur) { const row = await S.repo.insert('checklist_ticks', { period, item }); if (row) S.ticks.push(row); }
    if (!on && cur) { await S.repo.remove('checklist_ticks', cur.id); S.ticks = S.ticks.filter((x) => x !== cur); }
    await audit(on ? 'checklist.tick' : 'checklist.untick', null, { period, item }, `${on ? 'Completed' : 'Reopened'} checklist step "${item}" for ${period}.`);
    await refresh();
  },
  async saveBudgets(budgets) {
    if (!need('admin')) return;
    const clean = Object.fromEntries(Object.entries(budgets).filter(([, v]) => +v > 0).map(([k, v]) => [k, Math.round(+v)]));
    await S.repo.saveProfile({ budgets: clean }); S.profile = { ...S.profile, budgets: clean };
    await audit('budgets.save', null, { categories: Object.keys(clean).length }, `Set monthly budgets for ${Object.keys(clean).length} categor${Object.keys(clean).length === 1 ? 'y' : 'ies'}.`);
    toast('Budgets saved', 'Progress bars now track your limits.'); await refresh();
  },
  async completeLesson(id, score) {
    await audit('lesson.pass', id, { score }, `Passed the lesson "${id}" with ${score}/3.`);
    await award('lesson', id, 25, 'Lesson complete'); await refresh();
  },
  async remindStage(id, text) {
    const r = find(id), party = S.parties.find((p) => p.name === r.party);
    try { await navigator.clipboard.writeText(text); toast('Reminder copied', party?.phone ? 'Opening WhatsApp…' : 'Paste it into WhatsApp or email.'); } catch { if (!party?.phone) prompt('Copy this reminder:', text); }
    if (party?.phone) window.open(`https://wa.me/${phoneDigits(party.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    else if (party?.email) window.open(`mailto:${party.email}?subject=${encodeURIComponent('Payment reminder: ' + (r.number || ''))}&body=${encodeURIComponent(text)}`);
    await audit('reminder.send', id, { party: r.party, via: party?.phone ? 'whatsapp' : party?.email ? 'email' : 'copy' }, `Prepared a staged payment reminder for ${r.party} (invoice ${r.number || 'n/a'}, due ${r.due_date}).`);
    await award('alert_resolved', id + ':remind', XP.alert_resolved, 'Reminder prepared'); await refresh();
  },
  downloadInvoicePdf(id) {
    const inv = S.invoices.find((x) => x.id === id); if (!inv) return;
    const bytes = invoicePdf(V4.asDoc(S, inv));
    h('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), download: `Invoice-${inv.number.replace(/[^\w-]/g, '-')}.pdf` }).click();
    audit('invoice.pdf', id, { number: inv.number }, `Downloaded invoice ${inv.number} as PDF.`); toast('PDF downloaded', inv.number);
  },
  showEntries(number) { setTxQuery(String(number).toLowerCase()); A.go('transactions'); },
  openInvoice(id) {
    const inv = S.invoices.find((x) => x.id === id), w = window.open('', '_blank');
    if (!w) return toast('Pop-up blocked', 'Allow pop-ups to print invoices.', 'bad');
    w.document.write(taxInvoiceHtml(V4.asDoc(S, inv), S.profile)); w.document.close();
    audit('invoice.view', id, { number: inv.number }, `Opened invoice ${inv.number} for printing.`);
  },
  async saveInvoice(d, status) {
    if (!need('write')) return null;
    if (S.invoices.some((i) => i.number === d.number && i.id !== d.id)) return toast('Number already used', `Invoice ${d.number} exists. Change the number.`, 'bad'), null;
    const patch = { number: d.number, doc_type: d.doc_type, status, date: d.date, due_date: d.due_date, seller: d.seller, buyer: d.buyer, buyer_gstin: d.buyer_gstin, supply: d.supply, pos_state: d.pos_state, reverse_charge: d.reverse_charge, items: d.items, totals: d.totals, notes: d.notes };
    let row;
    try {
      if (d.id) { await S.repo.update('invoices', d.id, patch); row = Object.assign(S.invoices.find((i) => i.id === d.id), patch); }
      else { row = await S.repo.insert('invoices', patch); if (!row) return toast('Number already used', `Invoice ${d.number} exists.`, 'bad'), null; S.invoices.unshift(row); }
    } catch (x) { toast('Could not save invoice', x.message, 'bad'); return null; }
    if (status === 'issued') {
      for (const g of d.totals.byRate) if (g.taxable > 0) {
        const e = await S.repo.insert('entries', { kind: 'sale', number: d.number, party: d.buyer.name, gstin: d.buyer_gstin, date: d.date, due_date: d.due_date, taxable: g.taxable, gst_rate: g.gst, supply: d.supply, category: 'Sales', invoice_id: row.id });
        if (e) S.entries.unshift(e);
      }
      if (!S.parties.some((p) => p.kind === 'customer' && p.name === d.buyer.name)) {
        const p = await S.repo.insert('parties', { kind: 'customer', name: d.buyer.name, gstin: d.buyer_gstin, email: d.buyer.email || null, phone: d.buyer.phone || null, address: d.buyer.address || null, pincode: d.buyer.pincode || null });
        if (p) { S.parties.push(p); S.parties.sort((a, b) => a.name.localeCompare(b.name)); }
      }
      await audit('invoice.issue', row.id, { number: d.number, party: d.buyer.name, total: d.totals.payable }, `Issued ${d.doc_type === 'bos' ? 'bill of supply' : 'tax invoice'} ${d.number} to ${d.buyer.name} for ${inr(d.totals.payable)} (tax ${inr(d.totals.tax)}).`);
      compute(); await award('invoice_issued', row.id, 15, 'Invoice issued'); toast('Invoice issued', `${d.number} · ${inr(d.totals.payable)}`);
    } else { await audit('invoice.draft', row.id, { number: d.number }, `Saved draft invoice ${d.number} for ${d.buyer.name}.`); toast('Draft saved', d.number); }
    await refresh(); return true;
  },
  async deleteDraft(id) {
    if (!need('write')) return;
    const inv = S.invoices.find((i) => i.id === id); if (inv?.status !== 'draft') return;
    await S.repo.remove('invoices', id); S.invoices = S.invoices.filter((i) => i.id !== id);
    await audit('invoice.draft.delete', id, { number: inv.number }, `Deleted draft invoice ${inv.number}.`); await refresh();
  },
  async cancelInvoice(id) {
    if (!need('admin')) return;
    const inv = S.invoices.find((i) => i.id === id); if (inv?.status !== 'issued') return;
    await S.repo.update('invoices', id, { status: 'cancelled' }); inv.status = 'cancelled';
    for (const e of S.entries.filter((x) => x.invoice_id === id)) await S.repo.remove('entries', e.id);
    S.entries = S.entries.filter((x) => x.invoice_id !== id);
    await audit('invoice.cancel', id, { number: inv.number }, `Cancelled invoice ${inv.number} to ${inv.buyer.name}; its sale entries were removed.`);
    toast('Invoice cancelled', inv.number); await refresh();
  },
  async markInvoicePaid(id) {
    if (!need('write')) return;
    const inv = S.invoices.find((i) => i.id === id);
    for (const e of S.entries.filter((x) => x.invoice_id === id && !x.paid_date)) await A.markPaid(e.id, today(), true);
    await audit('invoice.paid', id, { number: inv.number }, `Marked invoice ${inv.number} as paid.`); await refresh();
  },
  async shareInvoice(id) {
    if (!need('write')) return;
    const inv = S.invoices.find((i) => i.id === id);
    if (S.repo.mode !== 'cloud') return toast('Demo mode', 'Download the invoice file and send it instead.', 'bad');
    try { await S.repo.update('invoices', id, { shared: true }); } catch (x) { return toast('Could not send', x.message, 'bad'); }
    Object.assign(inv, { shared: true, buyer_status: 'pending' });
    await audit('invoice.share', id, { number: inv.number, gstin: inv.buyer_gstin }, `Sent invoice ${inv.number} to the workspace registered under GSTIN ${inv.buyer_gstin}.`);
    toast('Sent', 'It now appears in the Received tab of the buyer.'); await refresh();
  },
  async saveEway(id, ew) {
    if (!need('write')) return;
    const inv = S.invoices.find((i) => i.id === id); await S.repo.update('invoices', id, { eway: ew }); inv.eway = ew;
    await audit('eway.save', id, { number: inv.number, ewb: ew.ewbNo || null }, `Saved e-way bill details for invoice ${inv.number}${ew.ewbNo ? ` (bill ${ew.ewbNo})` : ''}.`);
    toast('E-way details saved', inv.number); await refresh();
  },
  async acceptInvoice(doc, shared) {
    if (!need('write')) return;
    if (S.entries.some((e) => e.invoice_id === doc.id)) return toast('Already recorded', `Invoice ${doc.number} is in your books.`);
    for (const g of doc.totals.byRate) if (g.taxable > 0) {
      const e = await S.repo.insert('entries', { kind: 'purchase', number: doc.number, party: doc.seller.name, gstin: doc.seller.gstin || null, date: doc.date, due_date: doc.due_date, taxable: g.taxable, gst_rate: g.gst, supply: doc.supply, category: 'Purchases', note: doc.reverse_charge ? 'Reverse charge' : null, invoice_id: doc.id });
      if (e) S.entries.unshift(e);
    }
    if (!S.parties.some((p) => p.kind === 'vendor' && p.name === doc.seller.name)) {
      const p = await S.repo.insert('parties', { kind: 'vendor', name: doc.seller.name, gstin: doc.seller.gstin || null, email: doc.seller.email || null, phone: doc.seller.phone || null, address: doc.seller.address || null, pincode: doc.seller.pincode || null });
      if (p) { S.parties.push(p); S.parties.sort((a, b) => a.name.localeCompare(b.name)); }
    }
    if (shared) { try { await S.repo.respond(shared.id, true); shared.buyer_status = 'accepted'; } catch (x) { toast('Recorded, but the sender was not notified', x.message, 'bad'); } }
    await audit('invoice.accept', doc.id, { number: doc.number, from: doc.seller.name, total: doc.totals.payable }, `Accepted invoice ${doc.number} from ${doc.seller.name} (${inr(doc.totals.payable)}) and recorded it as a purchase.`);
    compute(); await award('invoice_accepted', doc.id, 10, 'Supplier invoice recorded'); toast('Purchase recorded', `${doc.seller.name} · ${inr(doc.totals.payable)}`); await refresh();
  },
  async rejectInvoice(id, note) {
    if (!need('write')) return;
    const row = S.inbox.find((i) => i.id === id);
    try { await S.repo.respond(id, false, note); } catch (x) { return toast('Could not reject', x.message, 'bad'); }
    row.buyer_status = 'rejected';
    await audit('invoice.reject', id, { number: row.number, from: row.seller.name }, `Rejected invoice ${row.number} from ${row.seller.name}${note ? `: ${note}` : ''}.`); await refresh();
  },
  async saveItem(it) {
    if (!need('write')) return;
    const row = await S.repo.insert('items', it); if (!row) return toast('Already exists', it.name, 'bad');
    S.items.push(row); S.items.sort((a, b) => a.name.localeCompare(b.name)); await audit('item.add', row.id, { name: it.name }, `Added "${it.name}" to the item catalog.`); await refresh();
  },
  async removeItem(id) {
    if (!need('write')) return;
    const it = S.items.find((x) => x.id === id); await S.repo.remove('items', id); S.items = S.items.filter((x) => x.id !== id);
    await audit('item.delete', id, { name: it.name }, `Removed "${it.name}" from the item catalog.`); await refresh();
  },
  // ---- payroll ----
  async saveEmployee(e, id) {
    if (!need('write')) return null;
    e = { ...e, code: e.code || `E${String(S.employees.length + 1).padStart(3, '0')}` };
    const errs = validateEmployee(e); if (errs.length) return toast('Check the details', errs[0], 'bad'), null;
    if (S.employees.some((x) => x.code === e.code && x.id !== id)) return toast('Employee code already used', e.code, 'bad'), null;
    let row;
    try {
      if (id) { await S.repo.update('employees', id, e); row = Object.assign(S.employees.find((x) => x.id === id), e); }
      else { row = await S.repo.insert('employees', e); if (!row) return toast('Employee code already used', e.code, 'bad'), null; S.employees.push(row); }
    } catch (x) { toast('Could not save', x.message, 'bad'); return null; }
    await audit(id ? 'employee.update' : 'employee.add', row.id, { name: e.name, code: e.code }, `${id ? 'Updated' : 'Added'} employee ${e.name} (${e.code}).`);
    if (payrollReadiness(S.employees, today().slice(0, 7), Infinity).slice(0, 4).every((c) => c.ok)) await award('payroll_ready', 'once', XP.payroll_ready, 'Payroll details complete');
    await refresh(); return row;
  },
  async importEmployees(rows) {
    if (!need('write')) return;
    let n = 0;
    for (const r of rows) {
      const code = r.code || `E${String(S.employees.length + 1).padStart(3, '0')}`;
      if (S.employees.some((x) => x.code === code)) continue;
      const row = await S.repo.insert('employees', { ...r, code }); if (row) { S.employees.push(row); n++; }
    }
    await audit('employee.import', null, { added: n }, `Imported ${n} employee(s) from a CSV file.`);
    toast('Imported', `${n} employee(s) added${n < rows.length ? `, ${rows.length - n} skipped (code already used)` : ''}`); await refresh();
  },
  async setEmployeeActive(id, on, leftDate = null) {
    if (!need('write')) return;
    const e = S.employees.find((x) => x.id === id), patch = { active: on, left_date: on ? null : leftDate || today() };
    await S.repo.update('employees', id, patch); Object.assign(e, patch);
    await audit(on ? 'employee.rejoin' : 'employee.exit', id, { name: e.name }, `${on ? 'Reactivated' : 'Marked as left'} employee ${e.name}.`); await refresh();
  },
  async savePayrollSettings(o) {
    if (!need('admin')) return;
    await S.repo.saveProfile({ payroll_settings: o }); S.profile = { ...S.profile, payroll_settings: o };
    await audit('payroll.settings', null, {}, 'Updated payroll settings.'); toast('Payroll settings saved'); await refresh();
  },
  async saveRun(period, inputs, status, payDate) {
    if (!need('write')) return null;
    const ex = S.runs.find((r) => r.period === period);
    if (ex && ['approved', 'paid'].includes(ex.status)) return toast('Already approved', `${monthName(period)} is locked.`, 'bad'), null;
    const built = buildRun(S.employees, inputs, period); if (!built.slips.length) return toast('No employees on this run', 'Add employees first.', 'bad'), null;
    const patch = { period, status, pay_date: payDate, totals: built.totals, note: null };
    try {
      let run;
      if (ex) { await S.repo.update('payroll_runs', ex.id, patch); run = Object.assign(ex, patch); for (const p of S.payslips.filter((x) => x.run_id === ex.id)) await S.repo.remove('payslips', p.id); S.payslips = S.payslips.filter((x) => x.run_id !== ex.id); }
      else { run = await S.repo.insert('payroll_runs', patch); if (!run) return toast('A run for this month exists', period, 'bad'), null; S.runs.unshift(run); }
      for (const s of built.slips) { const p = await S.repo.insert('payslips', { run_id: run.id, employee_id: s.employee_id, employee: s.employee, input: s.input, calc: s.calc, net: s.net }); if (p) S.payslips.push(p); }
      await audit('payroll.' + status, run.id, { period, headcount: built.totals.headcount, net: built.totals.net }, `${status === 'pending' ? 'Submitted' : 'Saved a draft of'} the ${monthName(period)} payroll for ${built.totals.headcount} employee(s): net pay ${inr(built.totals.net)}, employer cost ${inr(built.totals.employerCost)}.`);
      await award('payroll_run', period, XP.payroll_run, 'Payroll prepared'); toast(status === 'pending' ? 'Sent for approval' : 'Draft saved', monthName(period)); await refresh(); return run;
    } catch (x) { toast('Could not save payroll', x.message, 'bad'); return null; }
  },
  async rejectRun(id, note) {
    if (!need('admin')) return;
    const r = S.runs.find((x) => x.id === id); await S.repo.update('payroll_runs', id, { status: 'draft', note: note || null }); Object.assign(r, { status: 'draft', note: note || null });
    await audit('payroll.reject', id, { period: r.period }, `Sent the ${monthName(r.period)} payroll back to draft${note ? `: ${note}` : ''}.`); await refresh();
  },
  async approveRun(id) {
    if (!need('admin')) return;
    const r = S.runs.find((x) => x.id === id); if (r.status !== 'pending') return;
    if (S.repo.mode === 'cloud' && r.created_by === S.repo.userId && S.members.filter((m) => m.role === 'admin').length > 1) return toast('Another admin must approve', 'The person who prepared a run cannot approve it.', 'bad');
    try { await S.repo.update('payroll_runs', id, { status: 'approved' }); } catch (x) { return toast('Could not approve', x.message, 'bad'); }
    r.status = 'approved';
    for (const e of entriesFor(r.period, r.totals, r.pay_date)) { const row = await S.repo.insert('entries', { ...e, payroll_run_id: id }); if (row) S.entries.unshift(row); }
    await audit('payroll.approve', id, { period: r.period, net: r.totals.net }, `Approved the ${monthName(r.period)} payroll. Created salary and statutory dues entries (net pay ${inr(r.totals.net)}).`);
    toast('Payroll approved', 'Salary and statutory dues are now in your books.'); await refresh();
  },
  async markRunPaid(id, date = today()) {
    if (!need('admin')) return;
    const r = S.runs.find((x) => x.id === id); if (r.status !== 'approved') return;
    const sal = S.entries.find((e) => e.payroll_run_id === id && e.kind === 'salary'); if (sal && !sal.paid_date) await A.markPaid(sal.id, date, true);
    await S.repo.update('payroll_runs', id, { status: 'paid' }); r.status = 'paid'; r.paid_at = new Date().toISOString();
    const onTime = paidOnTime(r.period, date); compute();
    await audit('payroll.paid', id, { period: r.period, onTime }, `Marked the ${monthName(r.period)} payroll as paid on ${date}. ${onTime ? 'On time.' : 'Later than the 7th of the next month.'}`);
    if (onTime) { await award('payroll_on_time', r.period, XP.payroll_on_time, 'Salaries paid on time'); }
    toast('Payroll paid', onTime ? `On time. Streak: ${payrollStreak(S.events, today().slice(0, 7))} month(s)` : 'Salaries are due by the 7th of the next month.'); await refresh();
  },
  async deleteRun(id) {
    if (!need('write')) return;
    const r = S.runs.find((x) => x.id === id); if (r?.status !== 'draft') return;
    for (const p of S.payslips.filter((x) => x.run_id === id)) await S.repo.remove('payslips', p.id);
    await S.repo.remove('payroll_runs', id); S.runs = S.runs.filter((x) => x.id !== id); S.payslips = S.payslips.filter((x) => x.run_id !== id);
    await audit('payroll.delete', id, { period: r.period }, `Deleted the draft ${monthName(r.period)} payroll.`); await refresh();
  },
  downloadPayroll(runId, kind, employeeId) {
    const run = S.runs.find((x) => x.id === runId), slips = S.payslips.filter((x) => x.run_id === runId), save = (name, data, type) => h('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name }).click();
    if (!need('write')) return;
    if (kind === 'register') save(`payroll-register-${run.period}.csv`, registerCsv(slips.map((s) => ({ ...s, employee: s.employee }))), 'text/csv');
    else if (kind === 'bank') save(`bank-transfer-${run.period}.csv`, bankCsv(slips, run.period), 'text/csv');
    else if (kind === 'ecr') save(`ecr-${run.period}.txt`, ecrText(slips), 'text/plain');
    else save(employeeId ? `Payslip-${run.period}-${slips.find((s) => s.employee_id === employeeId)?.employee.code || 'employee'}.pdf` : `Payslips-${run.period}.pdf`, payslipPdf(run, employeeId ? slips.filter((s) => s.employee_id === employeeId) : slips, S.profile), 'application/pdf');
    audit('payroll.download', runId, { kind, period: run.period }, `Downloaded ${kind === 'payslip' ? (employeeId ? 'a payslip' : 'all payslips') : kind + ' file'} for ${monthName(run.period)}.`);
  },
  async saveReward(r) {
    if (!need('admin')) return;
    const row = await S.repo.insert('rewards', { ...r, active: true }); if (!row) return toast('Already exists', r.name, 'bad');
    S.rewards.push(row); S.rewards.sort((a, b) => a.xp_cost - b.xp_cost);
    await audit('reward.add', row.id, { name: r.name, xp: r.xp_cost, inr: r.cost_inr }, `Added reward "${r.name}" (${r.xp_cost} XP, company cost ${inr(r.cost_inr)}).`); await refresh();
  },
  async toggleReward(id) {
    if (!need('admin')) return;
    const r = S.rewards.find((x) => x.id === id); await S.repo.update('rewards', id, { active: !r.active }); r.active = !r.active;
    await audit('reward.toggle', id, { name: r.name, active: r.active }, `${r.active ? 'Enabled' : 'Paused'} reward "${r.name}".`); await refresh();
  },
  async removeReward(id) {
    if (!need('admin')) return;
    const r = S.rewards.find((x) => x.id === id); await S.repo.remove('rewards', id); S.rewards = S.rewards.filter((x) => x.id !== id);
    await audit('reward.delete', id, { name: r.name }, `Removed reward "${r.name}".`); await refresh();
  },
  async setPool(n) {
    if (!need('admin')) return;
    const v = Math.max(0, Math.round(+n || 0)); await S.repo.saveProfile({ reward_pool_monthly: v }); S.profile = { ...S.profile, reward_pool_monthly: v };
    await audit('reward.pool', null, { pool: v }, `Set the monthly reward pool to ${inr(v)}.`); toast('Reward pool saved', `${inr(v)} per month`); await refresh();
  },
  async redeem(rewardId) {
    const rw = S.rewards.find((x) => x.id === rewardId), m = today().slice(0, 7);
    if (!rw || !rw.active) return toast('Not available', 'This reward is paused.', 'bad');
    if (S.spendable < rw.xp_cost) return toast('Not enough XP', `You need ${rw.xp_cost - S.spendable} more XP.`, 'bad');
    const used = S.redemptions.filter((x) => x.status !== 'rejected' && x.created_at.slice(0, 7) === m).reduce((a, x) => a + x.cost_inr, 0);
    if (used + rw.cost_inr > (+S.profile.reward_pool_monthly || 0)) return toast('Pool used up', 'The company reward pool for this month is finished. Try next month.', 'bad');
    let row; try { row = await S.repo.insert('redemptions', { reward_id: rw.id, reward_name: rw.name, member_name: who(), xp_cost: rw.xp_cost, cost_inr: rw.cost_inr }); } catch (x) { return toast('Could not redeem', x.message, 'bad'); }
    S.redemptions.unshift(row); await audit('reward.redeem', row.id, { reward: rw.name, xp: rw.xp_cost }, `Requested reward "${rw.name}" for ${rw.xp_cost} XP.`);
    toast('Requested', 'An admin will approve it. Your XP is held until then.'); await refresh();
  },
  async decideRedemption(id, status, note = '') {
    if (!need('admin')) return;
    const r = S.redemptions.find((x) => x.id === id); await S.repo.update('redemptions', id, { status, note: note || null }); Object.assign(r, { status, note: note || null, decided_at: new Date().toISOString() });
    await audit('reward.' + status, id, { reward: r.reward_name, member: r.member_name }, `Marked reward "${r.reward_name}" for ${r.member_name || 'a member'} as ${status}${note ? `: ${note}` : ''}.`); await refresh();
  },
  backup() {
    localStorage.setItem('myf-last-backup', today());
    const data = { exported_at: new Date().toISOString(), company: S.profile.name, profile: S.profile, entries: S.entries, invoices: S.invoices, items: S.items, parties: S.parties, filings: S.filings, recurring: S.recurring, audit: S.orgLog };
    h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `backup-${today()}.json` }).click();
    audit('backup.export', null, { entries: S.entries.length, invoices: S.invoices.length }, 'Downloaded a full JSON backup.');
  },
  printInvoice(id) {
    const r = S.allRows.find((x) => x.id === id);
    if (r?.invoice_id && S.invoices.some((i) => i.id === r.invoice_id)) return A.openInvoice(r.invoice_id);
    const w = window.open('', '_blank');
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
    if (r.payroll_run_id) return toast('Part of a payroll run', 'Payroll entries are managed from the Payroll page.', 'bad');
    if (r.invoice_id && S.invoices.some((i) => i.id === r.invoice_id)) return toast('Part of an invoice', 'Cancel the invoice instead. That removes its entries and keeps the books consistent.', 'bad');
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
    const orgKeys = ['name', 'gstin', 'opening_balance', 'monthly_goal', 'approval_limit', 'budgets', 'invoice_settings', 'reward_pool_monthly', 'payroll_settings'];
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
// Payroll is reachable from the sidebar and the More sheet even before nav.js lists it (see TODO.md request to Sumit). Disappears from here once nav.js has it.
function ensurePayrollNav() {
  if (document.querySelector('[data-v="payroll"]')) return;
  const svg = (c) => iconSvg('users', c === 'nav-icon' ? 18 : 22).replace('<svg ', `<svg class="${c}" `);
  const side = document.querySelector('#desktop-nav a[data-v="transactions"]'), sheet = document.querySelector('.drawer-item[data-v="transactions"]');
  if (side) side.insertAdjacentHTML('afterend', `<a href="#payroll" data-v="payroll" data-role="write" title="Payroll">${svg('nav-icon')}<span class="nav-label">Payroll</span></a>`);
  if (sheet) sheet.insertAdjacentHTML('afterend', `<a href="#payroll" class="drawer-item" data-v="payroll" data-role="write">${svg('drawer-icon')}<span>Payroll</span></a>`);
}
function chrome() {
  ensurePayrollNav();
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
  const page = (ALL[view] || ALL.dashboard)(S, A), hasOwnBack = [...page.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Back');   // a page that already has its own Back (invoice form) keeps just that one
  root.append(...[view !== 'today' && !hasOwnBack && backButton(), h('h2', {}, TITLES[view] || ''), page].filter(Boolean));
  countUp(root);
}
// Back: hash routing already writes browser history, so we reuse it. history.state remembers how deep we are, which lets Back
// return to the previous page when there is one and otherwise go Today in place (never leaving the app, never a blank page).
let depth = history.state?.i ?? 0, goingHome = false;
if (history.state?.i == null) history.replaceState({ i: 0 }, '');
const goBack = () => { if (depth > 0) history.back(); else { goingHome = true; location.replace('#today'); } };
const backButton = () => h('button', { type: 'button', class: 'page-back', style: 'margin:0 0 12px', 'aria-label': 'Back to the previous page', title: 'Back', onclick: goBack }, icon('arrow-right', { size: 14, cls: 'flip' }), ' Back');
window.addEventListener('hashchange', () => {
  if (goingHome) { goingHome = false; depth = 0; history.replaceState({ i: 0 }, ''); }
  else if (history.state?.i == null) history.replaceState({ i: ++depth }, ''); else depth = history.state.i;
  view = location.hash.slice(1) || 'today'; render(); window.scrollTo({ top: 0 });
});

// ---- auth + workspace setup + boot ---------------------------------------------
function modal(...kids) { const box = $('#auth'); box.hidden = false; $('#app').hidden = true; const m = box.querySelector('.modal'); m.textContent = ''; m.append(h('span', { class: 'logo big' }, h('img', { src: 'public/logo-256.png', width: 90, height: 90, alt: '' })), ...kids); }
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
    for (const table of ['entries', 'filings', 'xp_events', 'parties', 'checklist_ticks']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => { clearTimeout(debounce); debounce = setTimeout(async () => { await load(); await refresh(); }, 400); });
    ch.subscribe();
  }
  setInterval(async () => { if (today() !== day0) { day0 = today(); if (await award('checkin', day0, XP.checkin, 'New day: daily check-in')) toast('New day', `${S.ctx.streak}-day streak`); await refresh(); } }, 60000);
}
$('#signout').onclick = () => A.signOut();
function paintSound() {
  const off = muted(), b = $('#snd'), l = $('#snd-label'), i = b.querySelector('.snd-icon');
  if (l) l.textContent = off ? 'Sound off' : 'Sound on';
  if (i) i.outerHTML = iconSvg(off ? 'sound-off' : 'sound', 16).replace('<svg ', '<svg class="snd-icon" ');
  b.setAttribute('aria-pressed', String(!off)); b.setAttribute('aria-label', off ? 'Turn sound on' : 'Turn sound off');
}
paintSound();
$('#snd').onclick = () => { setMuted(!muted()); paintSound(); };
boot();
