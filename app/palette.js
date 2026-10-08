// Command palette: Ctrl/⌘+K to jump anywhere or run a common action. Keyboard-first, screen-reader friendly.
import { theme } from './extras.js';
import { iconSvg } from './icons.js';
import { dialog } from './views4.js';
import { NAV } from './nav.js';

const DESC = { today: 'Your daily routine', dashboard: 'Cash, alerts and progress', invoices: 'Create GST invoices and e-way bills', transactions: 'Sales, bills, payroll, bank import', parties: 'Your contacts', approvals: 'Spend waiting for an admin', planner: '60-day forecast and budgets', compliance: 'GSTR-1 and GSTR-3B', standards: 'Due dates, ISO and legal readiness', reports: 'P&L, ageing, GST by month', insights: 'Ask the AI CFO', learn: 'Short money lessons', rewards: 'XP, store and who pays', audit: 'Who did what and why', team: 'Members and roles', settings: 'Company, invoices, appearance' };
const PAGES = NAV.flatMap((g) => g.items.map(([v, l]) => [v, l, DESC[v] || '']));
const clickByText = (re) => setTimeout(() => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent))?.click(), 400);
const ACTIONS = [
  { label: 'New invoice', hint: 'GST tax invoice or bill of supply', run: () => { location.hash = 'invoices'; clickByText(/new invoice/i); } },
  { label: 'Keyboard shortcuts', hint: 'Press ?', run: () => showHelp() },
  { label: 'Add transaction', hint: 'Sale, bill, expense or payroll', run: () => { location.hash = 'transactions'; clickByText(/add transaction/i); } },
  { label: 'Import bank statement (CSV)', hint: 'Match payments automatically', run: () => { location.hash = 'transactions'; clickByText(/import bank/i); } },
  { label: 'Switch theme (light / dark)', hint: 'Appearance', run: () => theme.toggle() },
  { label: 'Open Practice Lab', hint: '90-day simulation', run: () => { location.href = 'lab.html'; } },
  { label: 'About and what makes it different', hint: 'Landing page', run: () => { location.href = 'welcome.html'; } },
  { label: 'Terms · Privacy · Disclaimer', hint: 'Legal', run: () => { location.href = 'legal/privacy.html'; } },
  { label: 'Sign out', hint: 'End this session', run: () => document.getElementById('signout')?.click() },
];

let overlay, input, list, items = [], idx = 0, prevFocus;
function entries() {
  const visible = (v) => { const a = document.querySelector(`nav [data-v="${v}"]`); return !a || !a.hidden; };
  return [...PAGES.filter(([v]) => visible(v)).map(([v, l, d]) => ({ label: l, hint: d, group: 'Go to', run: () => { location.hash = v; } })), ...ACTIONS.map((a) => ({ ...a, group: 'Actions' }))];
}
function render(q = '') {
  const s = q.trim().toLowerCase(); items = entries().filter((e) => !s || (e.label + ' ' + e.hint).toLowerCase().includes(s)); idx = 0; list.textContent = '';
  if (!items.length) { const li = document.createElement('li'); li.className = 'pal-empty'; li.textContent = 'No matches'; list.append(li); input.removeAttribute('aria-activedescendant'); return; }
  let g = '';
  items.forEach((e, i) => {
    if (e.group !== g) { g = e.group; const h = document.createElement('li'); h.className = 'pal-group'; h.setAttribute('role', 'presentation'); h.textContent = g; list.append(h); }
    const li = document.createElement('li'); li.id = 'pal-' + i; li.setAttribute('role', 'option'); li.className = 'pal-item'; li.innerHTML = '<b></b><small></small>';
    li.firstChild.textContent = e.label; li.lastChild.textContent = e.hint; li.addEventListener('click', () => run(i)); li.addEventListener('mousemove', () => select(i)); list.append(li);
  });
  select(0);
}
function select(i) { idx = (i + items.length) % items.length; list.querySelectorAll('.pal-item').forEach((li, k) => { li.setAttribute('aria-selected', String(k === idx)); }); const el = document.getElementById('pal-' + idx); input.setAttribute('aria-activedescendant', 'pal-' + idx); el?.scrollIntoView({ block: 'nearest' }); }
function run(i) { const e = items[i]; close(); e?.run(); }
function close() { overlay?.remove(); overlay = null; document.removeEventListener('keydown', onKey, true); prevFocus?.focus?.(); }
function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowDown') { e.preventDefault(); select(idx + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); select(idx - 1); } else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
}
export function openPalette() {
  if (overlay || document.getElementById('app')?.hidden) return;
  prevFocus = document.activeElement; overlay = document.createElement('div'); overlay.className = 'overlay pal-overlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Command palette');
  overlay.innerHTML = '<div class="pal"><input class="pal-input" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Search pages and actions…" autocomplete="off" spellcheck="false"><ul id="pal-list" class="pal-list" role="listbox" aria-label="Results"></ul><div class="pal-foot"><span><kbd>' + iconSvg('arrow-up', 12) + '</kbd><kbd>' + iconSvg('arrow-down', 12) + '</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>';
  document.body.append(overlay); input = overlay.querySelector('input'); list = overlay.querySelector('ul');
  overlay.addEventListener('click', (e) => e.target === overlay && close()); input.addEventListener('input', () => render(input.value)); document.addEventListener('keydown', onKey, true); render(); input.focus();
}
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay ? close() : openPalette(); } });
function mount() {
  const actions = document.querySelector('.top-actions'); if (!actions || actions.querySelector('.pal-btn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pal-btn'; b.setAttribute('aria-label', 'Open command palette (Ctrl+K)');
  b.innerHTML = iconSvg('search', 16) + '<span>Search</span><kbd>Ctrl K</kbd>'; b.addEventListener('click', openPalette); actions.prepend(b);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

// ---- single-key shortcuts (ignored while typing or when a dialog is open) ----
const GO = { t: 'today', d: 'dashboard', i: 'invoices', x: 'transactions', p: 'parties', a: 'approvals', c: 'compliance', k: 'standards', w: 'rewards', r: 'reports', f: 'planner', n: 'insights', l: 'learn', u: 'audit', s: 'settings' };
const HELP = [['Ctrl K', 'Command palette'], ['?', 'This help'], ['i', 'New invoice'], ['n', 'New transaction'], ['/', 'Focus the search box'], ['t', 'Switch light / dark'], ['g then t / d / i / x', 'Go to Today / Dashboard / Invoices / Transactions'], ['g then p / a / c / k / r', 'Parties / Approvals / GST returns / Compliance / Reports'], ['g then f / n / l / u / s', 'Planner / Insights / Learn / Audit / Settings'], ['Ctrl S', 'Invoice form: save draft'], ['Ctrl Enter', 'Invoice form: issue invoice'], ['Enter', 'Invoice form: next line'], ['Esc', 'Close dialogs']];
function showHelp() {
  const rows = HELP.map(([k, d]) => { const r = document.createElement('div'); r.className = 'up'; r.innerHTML = '<kbd></kbd><span></span>'; r.firstChild.textContent = k; r.lastChild.textContent = d; return r; });
  dialog('Keyboard shortcuts', ...rows);
}
let pend = 0;
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || document.getElementById('app')?.hidden || e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.overlay:not([hidden])')) return;
  const k = e.key;
  if (pend && Date.now() - pend < 1200) { pend = 0; const v = GO[k.toLowerCase()]; if (v) { e.preventDefault(); location.hash = v; } return; }
  if (k === 'g') pend = Date.now();
  else if (k === '?') { e.preventDefault(); showHelp(); }
  else if (k === '/') { const s = document.querySelector('#view input[placeholder^="Search"]'); if (s) { e.preventDefault(); s.focus(); } }
  else if (k === 'i') ACTIONS[0].run();
  else if (k === 'n') ACTIONS[2].run();
  else if (k === 't') theme.toggle();
});
