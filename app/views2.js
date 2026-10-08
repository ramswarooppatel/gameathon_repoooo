// Company-workspace pages: Parties, Approvals, Reports, Team, Styleguide.
import { h, inr, today, toast } from './util.js';
import { validGstin } from '../tax/gst.js';
import { gstFor, prevMonth } from '../workspace/calc.js';
import { pnl, aging, topParties } from './reports.js';

const card = (title, ...kids) => h('section', { class: 'card' }, h('h3', {}, title), ...kids);
const empty = (t) => h('p', { class: 'mu' }, t);
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
      h('td', { class: 'acts' }, S.can('admin') && h('button', { onclick: () => confirm(`Delete ${p.name}?`) && A.removeParty(p.id) }, '✕')))), [4]) : empty('No parties yet. Add your first customer or vendor above.')));
}

// ---------------------------------------------------------------- Approvals
export function approvals(S, A) {
  const pending = S.allRows.filter((r) => r.approval === 'pending'), decided = S.allRows.filter((r) => r.approval === 'rejected').slice(0, 10), lim = +S.profile.approval_limit || 0;
  const row = (r) => h('div', { class: 'al med' }, h('span', {}, `${r.kind === 'salary' ? 'Payroll' : r.kind === 'sale' ? 'Sale' : 'Spend'}: ${r.party} · ${inr(r.total)} · ${r.number || 'no ref'} · dated ${r.date}`),
    S.can('admin') ? h('div', { class: 'acts' }, h('button', { class: 'pri', onclick: () => A.decide(r.id, true) }, 'Approve'), h('button', { onclick: () => { const n = prompt('Reason for rejecting (shown to the team):', ''); if (n !== null) A.decide(r.id, false, n); } }, 'Reject')) : h('span', { class: 'tag' }, 'Waiting for admin'));
  return h('div', { class: 'stack' },
    card(`Waiting for approval (${pending.length})`, h('p', { class: 'small mu' }, `Money-out entries above ${inr(lim)} created by non-admins need an admin's approval. Pending items are excluded from cash, GST and health until approved.`),
      ...(pending.length ? pending.map(row) : [empty('Nothing waiting. You are all caught up.')])),
    decided.length > 0 && card('Recently rejected', ...decided.map((r) => h('div', { class: 'up' }, h('div', {}, h('b', {}, `${r.party} · ${inr(r.total)}`), h('small', {}, r.approval_note || 'No reason given')), S.can('write') && h('button', { onclick: () => A.remove(r.id) }, 'Remove')))));
}

// ---------------------------------------------------------------- Reports
export function reports(S) {
  const months = [5, 4, 3, 2, 1, 0].map((i) => prevMonth(today().slice(0, 7), i)), rows = S.sum.rows, P = pnl(rows, months);
  const cats = [...new Set(P.flatMap((p) => Object.keys(p.byCat)))];
  const money = (n) => h('span', { class: n < 0 ? 'neg' : '' }, (n < 0 ? '−' : '') + inr(Math.abs(n)));
  const ag = (dir) => table(['Bucket', 'Items', 'Amount'], aging(rows, today(), dir).map((b) => h('tr', {}, td(b.label), td(String(b.count)), td(inr(b.amount), true))), [2]);
  const top = (dir) => { const t = topParties(rows, dir); return t.length ? table(['Party', 'Total'], t.map((x) => h('tr', {}, td(x.party), td(inr(x.amount), true))), [1]) : empty('No data yet.'); };
  const gst = months.map((m) => ({ m, g: gstFor(rows, m) }));
  const csv = () => download(`pnl-${today()}.csv`, ['Month,Income,Spend,Net', ...P.map((p) => `${p.month},${p.income},${p.spend},${p.net}`)].join(String.fromCharCode(10)));
  return h('div', { class: 'stack' },
    h('div', { class: 'row noprint' }, h('button', { onclick: () => window.print() }, 'Print / Save as PDF'), h('button', { onclick: csv }, 'Export P&L (CSV)')),
    card('Profit & loss (accrual, excl. GST)', table(['', ...months.map((m) => m.slice(2))], [
      h('tr', {}, td('Income'), ...P.map((p) => td(inr(p.income), true))),
      ...cats.map((c) => h('tr', { class: 'sub' }, td('  ' + c), ...P.map((p) => td(inr(p.byCat[c] || 0), true)))),
      h('tr', {}, td('Total spend'), ...P.map((p) => td(inr(p.spend), true))),
      h('tr', { class: 'tot' }, td('Net profit'), ...P.map((p) => h('td', { class: 'n' }, money(p.net)))),
    ], months.map((_, i) => i + 1))),
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