// One navigation config renders the sidebar, the phone tab bar and the "More" sheet, so labels, order and icons never drift apart.
import { iconSvg } from './icons.js';

// [view, label, icon, role?]  Groups are ordered by how a small business works: do today's work, sell and spend, stay compliant, grow, run the company.
export const NAV = [
  { items: [['today', 'Today', 'today'], ['dashboard', 'Dashboard', 'home']] },
  { title: 'Sell and spend', items: [['invoices', 'Invoices', 'invoices'], ['transactions', 'Transactions', 'transactions'], ['parties', 'Customers & vendors', 'users'], ['approvals', 'Approvals', 'approvals']] },
  { title: 'Plan and comply', items: [['planner', 'Cash planner', 'planner'], ['compliance', 'GST returns', 'compliance'], ['standards', 'Compliance', 'standards'], ['reports', 'Reports', 'reports']] },
  { title: 'Grow', items: [['insights', 'AI CFO', 'insights'], ['learn', 'Learn', 'learn'], ['rewards', 'Rewards', 'rewards']] },
  { title: 'Company', items: [['audit', 'Audit trail', 'audit'], ['team', 'Team & access', 'team', 'admin'], ['settings', 'Settings', 'settings']] },
];
export const LABELS = Object.fromEntries(NAV.flatMap((g) => g.items.map(([v, l]) => [v, l])));
const BAR = ['today', 'invoices', 'transactions', 'approvals'];            // phone tab bar; everything else lives under More
const badge = { dashboard: 'nav-n', approvals: 'nav-ap' };                   // ids main.js fills with counts
const esc = (s) => s.replace(/&/g, '&amp;');

function sidebar() {
  const nav = document.getElementById('desktop-nav'); if (!nav) return;
  nav.setAttribute('aria-label', 'Main');
  nav.innerHTML = NAV.map((g) => (g.title ? `<div class="nav-group" role="presentation">${g.title}</div>` : '') + g.items.map(([v, l, i, role]) =>
    `<a href="#${v}" data-v="${v}" title="${esc(l)}"${role ? ` data-role="${role}"` : ''}>${iconSvg(i, 18).replace('<svg ', '<svg class="nav-icon" ')}<span class="nav-label">${esc(l)}</span>${badge[v] ? `<em id="${badge[v]}" class="nav-badge" hidden></em>` : ''}</a>`).join('')).join('')
    + `<a href="lab.html" class="lab" title="Practice lab">${iconSvg('lab', 18).replace('<svg ', '<svg class="nav-icon" ')}<span class="nav-label">Practice lab</span></a>`;
}
function phoneBar() {
  const bar = document.getElementById('mobile-bar'), more = document.getElementById('mb-more-btn'); if (!bar || !more) return;
  bar.setAttribute('aria-label', 'Main');
  const all = Object.fromEntries(NAV.flatMap((g) => g.items.map((x) => [x[0], x])));
  bar.querySelectorAll('.mb-tab[data-v]').forEach((a) => a.remove());
  for (const v of BAR) { const [, l, i] = all[v], a = document.createElement('a'); a.href = '#' + v; a.className = 'mb-tab'; a.dataset.v = v;
    a.innerHTML = `${iconSvg(i, 22).replace('<svg ', '<svg class="mb-icon" ')}<span>${esc(l.split(' ')[0])}</span>${v === 'approvals' ? '<em id="mb-nav-ap" class="mb-badge" hidden></em>' : ''}`; bar.insertBefore(a, more); }
}
function sheet() {
  const grid = document.querySelector('#mobile-drawer .drawer-grid'), head = document.querySelector('#mobile-drawer .drawer-header b'); if (!grid) return;
  if (head) head.textContent = 'All pages';
  grid.className = 'drawer-sections';
  grid.innerHTML = NAV.map((g) => `<section>${g.title ? `<h3 class="drawer-sec">${g.title}</h3>` : '<h3 class="drawer-sec">Daily</h3>'}<div class="drawer-grid">${g.items.map(([v, l, i, role]) =>
    `<a href="#${v}" class="drawer-item" data-v="${v}"${role ? ` data-role="${role}"` : ''}>${iconSvg(i, 22).replace('<svg ', '<svg class="drawer-icon" ')}<span>${esc(l)}</span></a>`).join('')}</div></section>`).join('')
    + `<section><h3 class="drawer-sec">Practice</h3><div class="drawer-grid"><a href="lab.html" class="drawer-item lab-item">${iconSvg('lab', 22).replace('<svg ', '<svg class="drawer-icon" ')}<span>Practice lab</span></a></div></section>`;
  document.getElementById('mobile-drawer').addEventListener('click', (e) => { if (e.target.closest('a')) document.getElementById('drawer-close')?.click(); });
}
function sync() {
  const v = (location.hash.slice(1) || 'today').split('?')[0], t = document.getElementById('top-page-name'); if (t) t.textContent = LABELS[v] || v;
  document.querySelectorAll('[data-v]').forEach((a) => { const on = a.dataset.v === v; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
}
sidebar(); phoneBar(); sheet(); sync();
window.addEventListener('hashchange', sync);
