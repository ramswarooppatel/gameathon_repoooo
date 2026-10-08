// Company-workspace pages: Parties, Approvals, Reports, Team, Styleguide.
import { h, inr, today, toast } from './util.js';
import { validGstin } from '../tax/gst.js';
import { gstFor, prevMonth } from '../workspace/calc.js';
import { pnl, aging, topParties } from './reports.js';

const card = (title, ...kids) => h('section', { class: 'card' }, h('h3', {}, title), ...kids);
const empty = (t) => h('p', { class: 'mu' }, t);
const emptyState = (iconPath, title, desc, actionBtn = null) =>
  h('div', { class: 'empty-state-wrap' },
    h('svg', { viewBox: '0 0 24 24', width: '48', height: '48', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
      h('path', { d: iconPath })
    ),
    h('h4', {}, title),
    h('p', { class: 'mu small' }, desc),
    actionBtn
  );
const table = (head, rows, right = []) => h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...head.map((t, i) => h('th', { class: right.includes(i) ? 'n' : '' }, t)))), h('tbody', {}, ...rows)));
const td = (v, right) => h('td', { class: right ? 'n' : '' }, v);
const download = (name, text) => h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: name }).click();

// ---------------------------------------------------------------- Parties
export function parties(S, A) {
  const can = S.can('write');
  const kind = h('select', {}, h('option', { value: 'customer' }, 'Customer'), h('option', { value: 'vendor' }, 'Vendor'));
  const [name, gstin, email, phone] = [h('input', { placeholder: 'Name', required: true }), h('input', { placeholder: 'GSTIN', maxLength: 15 }), h('input', { type: 'email', placeholder: 'Email' }), h('input', { placeholder: 'WhatsApp / phone' })];
  gstin.oninput = () => { gstin.value = gstin.value.toUpperCase(); };
  const owed = (p) => S.sum.rows.filter((r) => r.party === p.name && !r.paid_date).reduce((s, r) => s + r.total, 0);
  const form = h('form', { class: 'row', onsubmit: async (e) => { e.preventDefault(); if (gstin.value && !validGstin(gstin.value)) return toast('Invalid GSTIN', 'Check all 15 characters.', 'bad'); await A.addParty({ kind: kind.value, name: name.value.trim(), gstin: gstin.value.trim() || null, email: email.value.trim() || null, phone: phone.value.trim() || null }); } },
    kind, name, gstin, email, phone, h('button', { class: 'pri', type: 'submit' }, 'Add'));
  return h('div', { class: 'stack' },
    can && card('Add customer or vendor', form, h('p', { class: 'small mu' }, 'Saved parties autofill the GSTIN when you add a transaction, and the phone number powers one-click WhatsApp reminders.')),
    card(`Directory (${S.parties.length})`, S.parties.length ? table(['Type', 'Name', 'GSTIN', 'Contact', 'Open balance', ''], S.parties.map((p) => h('tr', {}, td(p.kind === 'vendor' ? 'Vendor' : 'Customer'), td(p.name), td(p.gstin || '—'), td([p.email, p.phone].filter(Boolean).join(' · ') || '—'), td(inr(owed(p)), true),
      h('td', { class: 'acts' }, S.can('admin') && h('button', { onclick: () => confirm(`Delete ${p.name}?`) && A.removeParty(p.id) }, '✕')))), [4]) : emptyState('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', 'No parties saved yet', 'Add your customers and vendors to enable auto-fill GSTINs, balance tracking, and WhatsApp payment reminders.')));
}

// ---------------------------------------------------------------- Approvals
export function approvals(S, A) {
  const pending = S.allRows.filter((r) => r.approval === 'pending'), decided = S.allRows.filter((r) => r.approval === 'rejected').slice(0, 10), lim = +S.profile.approval_limit || 0;
  const row = (r) => h('div', { class: 'al med' }, h('span', {}, `${r.kind === 'salary' ? 'Payroll' : r.kind === 'sale' ? 'Sale' : 'Spend'}: ${r.party} · ${inr(r.total)} · ${r.number || 'no ref'} · dated ${r.date}`),
    S.can('admin') ? h('div', { class: 'acts' }, h('button', { class: 'pri', onclick: () => A.decide(r.id, true) }, 'Approve'), h('button', { onclick: () => { const n = prompt('Reason for rejecting (shown to the team):', ''); if (n !== null) A.decide(r.id, false, n); } }, 'Reject')) : h('span', { class: 'tag' }, 'Waiting for admin'));
  return h('div', { class: 'stack' },
    card(`Waiting for approval (${pending.length})`, h('p', { class: 'small mu' }, `Money-out entries above ${inr(lim)} created by non-admins need an admin's approval. Pending items are excluded from cash, GST and health until approved.`),
      ...(pending.length ? pending.map(row) : [emptyState('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 'All clear · Zero pending approvals', 'All high-value expenses and payroll items have been reviewed and approved.')])),
    decided.length > 0 && card('Recently rejected', ...decided.map((r) => h('div', { class: 'up' }, h('div', {}, h('b', {}, `${r.party} · ${inr(r.total)}`), h('small', {}, r.approval_note || 'No reason given')), S.can('write') && h('button', { onclick: () => A.remove(r.id) }, 'Remove')))));
}

// ---------------------------------------------------------------- Reports
function comboChart(P) {
  const W = 620, H = 200, bw = 22, g = W / P.length;
  const maxVal = Math.max(1, ...P.flatMap((p) => [p.income, p.spend, Math.abs(p.net)]));
  
  // Dual representation: Income (Green Bar) vs Spend (Grey Bar) with Net Profit accent line
  const netPoints = P.map((p, i) => {
    const x = i * g + g / 2;
    // Map net profit vertically where zero is midway if negative, or scaled
    const y = H - 24 - ((p.net + maxVal) / (maxVal * 2)) * (H - 50);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  let s = `<svg viewBox="0 0 ${W} ${H + 30}" class="chart combo-chart" role="img" aria-label="Monthly P&L Net Profit Combo Chart">
    <title>Monthly P&L Performance (Income vs Spend & Net Profit)</title>
    <desc>Vertical bars represent gross income and spend, overlaid with a connected net profit trend line.</desc>`;

  // Grid lines
  for (let l = 1; l <= 3; l++) {
    const y = Math.round((H / 4) * l);
    s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--line-subtle)" stroke-dasharray="3 3"/>`;
  }

  // Zero baseline for Net line
  const zeroY = H - 24 - (maxVal / (maxVal * 2)) * (H - 50);
  s += `<line x1="0" y1="${zeroY.toFixed(1)}" x2="${W}" y2="${zeroY.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2 2"/>`;

  // Bars for Income & Spend
  P.forEach((p, i) => {
    const x = i * g + g / 2;
    const hi = Math.max(3, (p.income / maxVal) * (H - 50));
    const hs = Math.max(3, (p.spend / maxVal) * (H - 50));
    const monthLabel = p.month.slice(5) + '/' + p.month.slice(2, 4);

    s += `<g class="chart-col" tabindex="0" aria-label="${p.month}: Income ₹${Math.round(p.income)}, Spend ₹${Math.round(p.spend)}, Net ₹${Math.round(p.net)}">
      <rect class="bar-income" x="${x - bw - 2}" y="${H - 24 - hi}" width="${bw}" height="${hi}" rx="4" fill="var(--acc)"/>
      <rect class="bar-spend" x="${x + 2}" y="${H - 24 - hs}" width="${bw}" height="${hs}" rx="4" fill="#5c756a"/>
      <text x="${x}" y="${H + 18}" text-anchor="middle" fill="var(--mu)" font-size="11" font-weight="500">${monthLabel}</text>
    </g>`;
  });

  // Net Profit Line & Dots
  s += `<polyline fill="none" stroke="var(--acc2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${netPoints}" class="net-trend-line"/>`;

  P.forEach((p, i) => {
    const x = i * g + g / 2;
    const y = H - 24 - ((p.net + maxVal) / (maxVal * 2)) * (H - 50);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#ffffff" stroke="var(--acc2)" stroke-width="2"/>`;
  });

  s += '</svg>';

  const legend = h('div', { class: 'chart-legend' },
    h('span', { class: 'leg-item leg-in' }, h('i', {}), 'Income (Sales)'),
    h('span', { class: 'leg-item leg-out' }, h('i', {}), 'Total Spend'),
    h('span', { class: 'leg-item leg-net-line' }, h('i', { style: 'background:var(--acc2);height:3px;' }), 'Net Profit Trend'),
    h('span', { class: 'leg-net mu small' }, `6M Net: ${inr(P.reduce((a, c) => a + c.net, 0))}`)
  );

  const container = h('div', { class: 'chart-box combo-chart-container' });
  container.innerHTML = legend.outerHTML + s;
  return container;
}

export function reports(S) {
  const months = [5, 4, 3, 2, 1, 0].map((i) => prevMonth(today().slice(0, 7), i)), rows = S.sum.rows, P = pnl(rows, months);
  const cats = [...new Set(P.flatMap((p) => Object.keys(p.byCat)))];
  const money = (n) => h('span', { class: n < 0 ? 'neg' : '' }, (n < 0 ? '−' : '') + inr(Math.abs(n)));
  const ag = (dir) => {
    const list = aging(rows, today(), dir);
    return list.some((b) => b.count > 0)
      ? table(['Bucket', 'Items', 'Amount'], list.map((b) => h('tr', {}, td(b.label), td(String(b.count)), td(inr(b.amount), true))), [2])
      : emptyState('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', `No ${dir === 'in' ? 'receivables' : 'payables'} aging`, `All ${dir === 'in' ? 'customer' : 'vendor'} invoices are settled.`);
  };
  const top = (dir) => {
    const t = topParties(rows, dir);
    return t.length
      ? table(['Party', 'Total'], t.map((x) => h('tr', {}, td(x.party), td(inr(x.amount), true))), [1])
      : emptyState('M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', `No ${dir === 'in' ? 'customer' : 'vendor'} volume yet`, 'Transaction totals will aggregate here automatically.');
  };
  const gst = months.map((m) => ({ m, g: gstFor(rows, m) }));
  const csv = () => download(`pnl-${today()}.csv`, ['Month,Income,Spend,Net', ...P.map((p) => `${p.month},${p.income},${p.spend},${p.net}`)].join(String.fromCharCode(10)));
  
  // Print-only Business Header
  const printHeader = h('div', { class: 'print-report-header' },
    h('div', { class: 'print-biz-name' }, S.profile.name || 'Oxro Labs · Finance Desk'),
    h('div', { class: 'print-biz-meta' },
      h('span', {}, `GSTIN: ${S.profile.gstin || 'Unregistered'}`),
      h('span', {}, `Generated: ${today()}`)
    )
  );

  return h('div', { class: 'stack' },
    printHeader,
    h('div', { class: 'row noprint' },
      h('button', { class: 'pri', onclick: () => window.print() }, '🖨 Print / Save as PDF'),
      h('button', { onclick: csv }, 'Export P&L (CSV)')
    ),
    card('Profit & loss (accrual, excl. GST)',
      comboChart(P),
      table(['', ...months.map((m) => m.slice(2))], [
        h('tr', {}, td('Income'), ...P.map((p) => td(inr(p.income), true))),
        ...cats.map((c) => h('tr', { class: 'sub' }, td('  ' + c), ...P.map((p) => td(inr(p.byCat[c] || 0), true)))),
        h('tr', {}, td('Total spend'), ...P.map((p) => td(inr(p.spend), true))),
        h('tr', { class: 'tot' }, td('Net profit'), ...P.map((p) => h('td', { class: 'n mono' }, money(p.net)))),
      ], months.map((_, i) => i + 1))
    ),
    h('div', { class: 'grid2' }, card('Receivables aging', ag('in')), card('Payables aging', ag('out'))),
    h('div', { class: 'grid2' }, card('Top customers', top('in')), card('Top vendors', top('out'))),
    card('GST by month', table(['Month', 'Output tax', 'Input credit', 'Net payable', 'Credit at risk'], gst.map(({ m, g }) => h('tr', {}, td(m), td(inr(g.output.cgst + g.output.sgst + g.output.igst), true), td(inr(g.itc.cgst + g.itc.sgst + g.itc.igst), true), td(inr(g.net.total), true), td(inr(g.itcAtRisk), true))), [1, 2, 3, 4]),
      h('p', { class: 'small mu' }, 'Planning estimates. Verify with your Chartered Accountant before filing.')));
}


// ---------------------------------------------------------------- Team
export function team(S, A) {
  const adm = S.can('admin'), demo = S.repo.mode === 'demo';
  const lim = h('input', { type: 'number', min: 0, step: '1000', value: S.profile.approval_limit ?? 25000, class: 'amt' });
  const rows = S.members.map((m) => {
    const me = m.user_id === S.repo.userId;
    const sel = h('select', { disabled: !adm || (me && !demo), onchange: (e) => A.setRole(m.user_id, e.target.value) }, ...['admin', 'finance', 'viewer'].map((r) => h('option', { value: r, selected: r === m.role }, r)));
    return h('tr', {}, td((m.display_name || 'Member') + (me ? ' (you)' : '')), td(sel), td(m.created_at ? m.created_at.slice(0, 10) : '—'), h('td', { class: 'acts' }, adm && !me && h('button', { onclick: () => confirm('Remove this member?') && A.removeMember(m.user_id) }, 'Remove')));
  });
  return h('div', { class: 'stack' },
    card(`Team (${S.members.length})`, table(['Name', 'Role', 'Joined', ''], rows),
      h('p', { class: 'small mu' }, 'Admin: everything, including approvals, deletes and team. Finance: add and edit transactions, parties, filings. Viewer: read only.')),
    h('div', { class: 'grid2' },
      card('Invite teammates', h('p', { class: 'mu' }, 'Share this code. New members join as Viewer; promote them above.'), h('div', { class: 'row' }, h('code', { class: 'code' }, S.repo.org.invite_code || '—'), h('button', { onclick: async () => { await navigator.clipboard?.writeText(S.repo.org.invite_code); toast('Copied', 'Invite code copied'); } }, 'Copy')),
        S.repo.org.allowed_domain && h('p', { class: 'small mu' }, `Only @${S.repo.org.allowed_domain} email addresses can join.`)),
      card('Approval policy', h('p', { class: 'mu' }, 'Spend entered by non-admins above this amount (incl. GST) waits for admin approval.'), h('div', { class: 'row' }, lim, h('button', { class: 'pri', disabled: !adm, onclick: () => A.saveProfile({ approval_limit: +lim.value || 0 }) }, 'Save limit')),
        demo && h('div', { class: 'al med' }, h('span', {}, 'Demo: switch role to test permissions'), h('select', { onchange: (e) => A.demoRole(e.target.value) }, ...['admin', 'finance', 'viewer'].map((r) => h('option', { value: r, selected: r === S.repo.role }, r)))))));
}

// ---------------------------------------------------------------- Styleguide (#styleguide)
export function styleguide() {
  const swatch = (name, color) => h('div', { style: 'text-align:center;min-width:68px' },
    h('div', { style: `width:48px;height:48px;background:${color};border-radius:var(--r-md);border:1px solid var(--line);margin:0 auto 4px` }),
    h('small', { class: 'mu' }, name)
  );

  return h('div', { class: 'stack' },
    h('div', { class: 'row' },
      h('h2', { style: 'margin:0' }, 'Oxro Labs Design System'),
      h('span', { class: 'pill info' }, '#styleguide')
    ),

    card('Color Tokens & Scales',
      h('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:center' },
        swatch('Accent', 'var(--acc)'),
        swatch('Accent 2', 'var(--acc2)'),
        swatch('Warning', 'var(--warn)'),
        swatch('Danger', 'var(--bad)'),
        swatch('Info', 'var(--info)'),
        swatch('Muted', 'var(--mu)'),
        swatch('Card', 'var(--card)'),
        swatch('Line', 'var(--line)'),
        swatch('Sidebar', 'var(--bg-sidebar)')
      )
    ),

    h('div', { class: 'grid2' },
      card('Buttons & Variants',
        h('div', { class: 'acts', style: 'align-items:center;gap:8px' },
          h('button', { class: 'pri' }, 'Primary'),
          h('button', { class: 'sec' }, 'Secondary'),
          h('button', { class: 'ghost' }, 'Ghost'),
          h('button', { class: 'danger' }, 'Danger'),
          h('button', { class: 'pri sm' }, 'Small'),
          h('button', { class: 'sec lg' }, 'Large'),
          h('button', { class: 'pri is-loading' }, 'Loading')
        )
      ),

      card('Tags & Status Pills',
        h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          h('span', { class: 'tag' }, 'Default Tag'),
          h('span', { class: 'tag paid' }, 'Paid (Active)'),
          h('span', { class: 'tag over' }, 'Overdue'),
          h('span', { class: 'pill' }, 'Level 4'),
          h('span', { class: 'pill warn' }, 'Pending Admin'),
          h('span', { class: 'pill bad' }, 'Blocked')
        )
      )
    ),

    card('Form Controls & Validation States',
      h('div', { class: 'form' },
        h('label', {}, 'Text Input',
          h('input', { type: 'text', placeholder: 'Vendor or client name' }),
          h('span', { class: 'input-helper' }, 'Helper text for user context')
        ),
        h('label', {}, 'Select Option',
          h('select', {},
            h('option', { value: 'sale' }, 'Sale (Invoice)'),
            h('option', { value: 'spend' }, 'Expense (Spend)')
          )
        ),
        h('label', { class: 'has-error' }, 'Error State Field',
          h('input', { type: 'text', value: '29ABCDE1234F1Z', class: 'error' }),
          h('span', { class: 'error-text' }, 'Invalid GSTIN checksum')
        ),
        h('label', {}, 'Currency Input (Mono)',
          h('input', { class: 'amt mono', type: 'text', value: '₹45,000' })
        ),
        h('label', { class: 'chk full' },
          h('input', { type: 'checkbox', checked: true }),
          'ITC eligible input credit claim'
        )
      )
    ),

    card('Tables (Sticky Header, Zebra Hover)',
      table(['Invoice #', 'Party', 'Status', 'Total'], [
        h('tr', {}, td('INV-2026-001'), td('Acme Systems'), td(h('span', { class: 'tag paid' }, 'Paid')), td(inr(25000), true)),
        h('tr', {}, td('INV-2026-002'), td('Nova Technologies'), td(h('span', { class: 'tag over' }, 'Overdue')), td(inr(12800), true)),
        h('tr', {}, td('INV-2026-003'), td('Vanguard Media'), td(h('span', { class: 'tag' }, 'Pending')), td(inr(6400), true))
      ], [3])
    ),

    h('div', { class: 'grid2' },
      card('Skeletons & Loaders',
        h('div', { class: 'stack' },
          h('div', { class: 'skeleton skeleton-title' }),
          h('div', { class: 'skeleton skeleton-text' }),
          h('div', { class: 'skeleton skeleton-text', style: 'width:70%' }),
          h('div', { class: 'skeleton skeleton-kpi' })
        )
      ),

      card('Empty State Pattern',
        h('div', { class: 'empty-state' },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', 'stroke-width': '2' },
            h('path', { d: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' }),
            h('polyline', { points: '13 2 13 9 20 9' })
          ),
          h('h4', {}, 'No Transactions Found'),
          h('p', {}, 'Add your first invoice or import sample data from Settings to populate this table.'),
          h('button', { class: 'pri sm' }, 'Add Entry')
        )
      )
    )
  );
}