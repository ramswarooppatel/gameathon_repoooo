import * as db from './db/supabase.js';
import { pick, migrateLocal } from './workspace/store.js';
import { summarize, toCsv, guessSupply } from './workspace/calc.js';
import { validGstin } from './tax/gst.js';
import { explain } from './ai/groq.js';

const $ = (id) => document.getElementById(id);
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const el = (t, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); e.append(...k); return e; };
const today = () => new Date().toISOString().slice(0, 10);
let store, entries = [], profile = {}, sum;

async function refresh() {
  [entries, profile] = [await store.list(), (await store.getProfile()) || {}];
  sum = summarize(entries, profile, today());
  $('k-cash').textContent = inr(sum.cash); $('k-recv').textContent = inr(sum.receivable); $('k-pay').textContent = inr(sum.payable);
  $('k-gst').textContent = inr(sum.gst.net.total); $('k-run').textContent = `${sum.runwayMonths} mo`;
  $('k-health').textContent = entries.length ? sum.health : '—'; $('k-bar').style.width = sum.health + '%';
  $('k-cash').style.color = sum.cash < 0 ? 'var(--bad)' : '';
  $('biz').textContent = profile.name || 'Your books, GST and cash in one place';
  $('pn').value = profile.name || ''; $('pgst').value = profile.gstin || ''; $('pob').value = profile.opening_balance ?? '';
  const g = sum.gst;
  $('gst').innerHTML = '';
  for (const [a, b] of [['Output tax (sales)', g.output], ['Input credit (valid GSTIN)', g.itc]])
    $('gst').append(el('div', {}, `${a}: CGST ${inr(b.cgst)} · SGST ${inr(b.sgst)} · IGST ${inr(b.igst)}`));
  $('gst').append(el('b', { textContent: `Net payable ${inr(g.net.total)}` }));
  $('due').textContent = `Next: GSTR-1 by ${sum.gstr1}, GSTR-3B by ${sum.gstr3b}.`;
  $('al-n').textContent = sum.alerts.length; $('alerts').textContent = '';
  if (!sum.alerts.length) $('alerts').append(el('p', { className: 'mu', textContent: entries.length ? 'All clear. Nothing needs your attention.' : 'Add your first invoice or bill to start.' }));
  for (const a of sum.alerts) $('alerts').append(el('div', { className: 'al ' + a.sev, textContent: a.text }));
  const tb = $('rows'); tb.textContent = '';
  for (const r of [...sum.rows].sort((a, b) => b.date.localeCompare(a.date))) {
    const over = !r.paid_date && r.due_date && r.due_date < today();
    tb.append(el('tr', {}, el('td', { textContent: r.kind === 'sale' ? 'Sale' : 'Bill' }), el('td', { textContent: r.number || '' }), el('td', { textContent: r.party }),
      el('td', { textContent: r.date }), el('td', { textContent: r.due_date || '' }),
      el('td', { className: 'n', textContent: inr(r.taxable) }), el('td', { className: 'n', textContent: inr(r.tax.total) }), el('td', { className: 'n', textContent: inr(r.total) }),
      el('td', {}, el('span', { className: 'tag ' + (r.paid_date ? 'paid' : over ? 'over' : ''), textContent: r.paid_date ? 'Paid' : over ? 'Overdue' : 'Open' })),
      el('td', {}, ...(r.paid_date ? [] : [el('button', { textContent: 'Mark paid', onclick: async () => { await store.update(r.id, { paid_date: today() }); refresh(); } })]),
        el('button', { textContent: '✕', title: 'Delete', onclick: async () => { if (confirm('Delete this entry?')) { await store.remove(r.id); refresh(); } } }))));
  }
}

function hint() {
  const pg = $('pg').value.toUpperCase(), own = profile.gstin || '';
  $('gs').textContent = pg ? (validGstin(pg) ? 'GSTIN valid.' : 'GSTIN looks invalid (ITC on purchases will be flagged).') : '';
  if (validGstin(pg) && validGstin(own)) $('supply').value = guessSupply(own, pg);
}
$('pg').oninput = hint;

$('f').onsubmit = async (ev) => {
  ev.preventDefault();
  const e = { kind: $('kind').value, number: $('number').value.trim() || null, party: $('party').value.trim(), gstin: $('pg').value.trim().toUpperCase() || null,
    date: $('date').value, due_date: $('due').value || null, taxable: +$('taxable').value, gst_rate: +$('rate').value, supply: $('supply').value, paid_date: $('paid').value || null };
  try { await store.add(e); $('f').reset(); $('date').value = today(); $('rate').value = 18; refresh(); } catch (x) { alert('Could not save: ' + x.message); }
};
$('psave').onclick = async () => {
  const g = $('pgst').value.trim().toUpperCase();
  if (g && !validGstin(g)) return alert('Your GSTIN is not valid. Check all 15 characters.');
  await store.setProfile({ name: $('pn').value.trim(), gstin: g || null, opening_balance: +$('pob').value || 0 }); refresh();
};
$('csv').onclick = () => el('a', { href: URL.createObjectURL(new Blob([toCsv(sum.rows)], { type: 'text/csv' })), download: `registers-${today()}.csv` }).click();
$('explain').onclick = async () => {
  $('ai-out').textContent = '…';
  const facts = `Cash ₹${sum.cash}, to collect ₹${sum.receivable} (overdue ₹${sum.overdueAmt}), to pay ₹${sum.payable}, GST payable this month ₹${sum.gst.net.total}, runway ${sum.runwayMonths} months, ${sum.alerts.length} alerts. Summarise and give the next action.`;
  $('ai-out').textContent = await explain(facts, `Cash ${inr(sum.cash)}; ${inr(sum.receivable)} to collect; GST ${inr(sum.gst.net.total)} due by ${sum.gstr3b}. ${sum.alerts[0]?.text || 'No urgent items.'}`);
};

async function authBox() {
  const box = $('auth'); box.textContent = '';
  const sb = db.client();
  if (!sb) return box.append(el('p', { className: 'mu small', textContent: 'Cloud sync is not configured. Data is saved in this browser only. Set SUPABASE_ANON_KEY in .env and run npm run sync-env.' }));
  if (store.mode === 'cloud') {
    const { data } = await sb.auth.getUser();
    return box.append(el('p', { className: 'mu small', textContent: `Signed in as ${data.user.email}. Data syncs to your account.` }), el('button', { textContent: 'Sign out', onclick: async () => { await db.signOut(); location.reload(); } }));
  }
  const email = el('input', { type: 'email', placeholder: 'you@business.com' });
  box.append(el('p', { className: 'mu small', textContent: 'Sign in with a one-time email link to keep your books safe across devices.' }),
    el('div', { className: 'row' }, email, el('button', { textContent: 'Email me a link', onclick: async () => { try { await db.signInEmail(email.value); box.append(el('p', { className: 'mu small', textContent: 'Check your inbox for the sign-in link.' })); } catch (x) { alert(x.message); } } })));
}

$('date').value = today();
await db.init(false);
store = await pick();
if (store.mode === 'cloud') { const n = await migrateLocal(store); if (n) console.info(`moved ${n} local entries to cloud`); }
$('mode').textContent = store.mode === 'cloud' ? 'Synced' : 'Local only';
await authBox();
await refresh();
