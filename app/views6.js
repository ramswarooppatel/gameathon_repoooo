// Payroll page: run payroll month by month, employees, history and files, statutory settings. Admins and finance only.
import { h, inr, today, toast } from './util.js';
import { icon } from './icons.js';
import { dialog } from './views4.js';
import { BADGES } from './gamify.js';
import { calcPayslip, PT_STATES, PF, ESI } from '../tax/payroll.js';
import { buildRun, onRun, dueDates, daysInMonth, nextMonth, prevMonthOf, monthName, payrollStreak, payrollReadiness, parseEmployeesCsv, validateEmployee, paidOnTime } from '../workspace/payroll.js';
import { daysBetween } from '../workspace/calc.js';

const card = (title, ...kids) => h('section', { class: 'card' }, title && h('h3', {}, title), ...kids);
const seg = (items, cur, set) => h('div', { class: 'seg tabs-seg', role: 'tablist' }, ...items.map(([id, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(cur === id), 'aria-pressed': String(cur === id), onclick: () => set(id) }, l)));
const table = (head, rows, right = []) => h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...head.map((t, i) => h('th', { class: right.includes(i) ? 'n' : '' }, t)))), h('tbody', {}, ...rows)));
const td = (v, right) => h('td', { class: right ? 'n' : '' }, v);
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const ST = { draft: ['Draft', ''], pending: ['Waiting for approval', 'warn'], approved: ['Approved, to pay', 'info'], paid: ['Paid', 'good'] };

let tab = 'run', period = null, inputs = {}, payDate = '', loaded = null;
const lastDay = (ym) => `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
function defaultPeriod(S) {
  const t = today().slice(0, 7), p = prevMonthOf(t), r = S.runs.find((x) => x.period === p);
  return S.employees.length && (!r || r.status !== 'paid') && !S.runs.some((x) => x.period === t) ? p : t;
}
function open(S, ym) {
  period = ym; const run = S.runs.find((r) => r.period === ym); loaded = ym;
  inputs = {}; if (run) for (const s of S.payslips.filter((x) => x.run_id === run.id)) inputs[s.employee_id] = { ...s.input };
  payDate = run?.pay_date || lastDay(ym);
}

// ---------------------------------------------------------------- the game layer: streak, badges, readiness
function strip(S, checks) {
  const t = today().slice(0, 7), streak = payrollStreak(S.events, t), earned = new Set(S.badges.map((b) => b.code)), pct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const next = streak >= 3 ? 'You have earned Payday Pro. Keep the streak alive.' : `Pay on time ${3 - streak} more month${3 - streak === 1 ? '' : 's'} to earn Payday Pro.`;
  return h('div', { class: 'pay-strip card' },
    h('div', { class: 'pay-streak' }, h('span', { class: 'pay-flame' }, icon('flame', { size: 22 })), h('div', {}, h('b', { class: 'big' }, `${streak}-month streak`), h('small', { class: 'mu block' }, next))),
    h('div', { class: 'pay-badges' }, ...['payday', 'payday_pro', 'dues_clean'].map((c) => { const b = BADGES.find((x) => x.code === c), on = earned.has(c); return h('div', { class: 'badge ' + (on ? 'on' : ''), title: b.desc }, h('span', { class: 'badge-symbol' }, icon(on ? 'trophy' : 'lock', { size: 16 })), h('b', {}, b.title), h('small', {}, b.desc)); })),
    h('div', { class: 'pay-ready' }, h('div', { class: 'ring', style: `--p:${pct}`, role: 'img', 'aria-label': `Payroll ${pct} percent ready` }, h('b', {}, pct + '%')), h('small', { class: 'mu' }, 'Payroll readiness')));
}

// ---------------------------------------------------------------- Run payroll
function run(S, A, checks) {
  if (loaded !== period) open(S, period);
  const rn = S.runs.find((r) => r.period === period), editable = !rn || rn.status === 'draft', admin = S.can('admin');
  const stored = rn ? S.payslips.filter((x) => x.run_id === rn.id) : [], step = !rn ? 1 : { draft: 2, pending: 3, approved: 4, paid: 5 }[rn.status];
  const emps = S.employees.filter((e) => onRun(e, period)), d = dueDates(period);
  const sumBox = h('div', { class: 'grid3 pay-sum' }), cells = {};
  const built = () => (editable ? buildRun(S.employees, inputs, period) : { slips: stored, totals: rn.totals });
  const recalc = () => {
    const b = built(), t = b.totals, cashAfter = S.sum.cash - t.net;
    b.slips.forEach((s) => { const c = cells[s.employee_id]; if (c) { c.gross.textContent = money(s.calc.gross); c.ded.textContent = money(s.calc.totalDeductions); c.net.textContent = money(s.net); } });
    cells.total.textContent = money(t.net);
    sumBox.replaceChildren(
      h('div', { class: 'card' }, h('small', { class: 'mu' }, 'Net pay to employees'), h('b', { class: 'big' }, money(t.net)), h('small', { class: 'mu block' }, `${t.headcount} employee${t.headcount === 1 ? '' : 's'} · gross ${money(t.gross)}`)),
      h('div', { class: 'card' }, h('small', { class: 'mu' }, 'Total cost to the company'), h('b', { class: 'big' }, money(t.employerCost)), h('small', { class: 'mu block' }, `includes employer PF and ESI ${money(t.pfEr + t.pfAdmin + t.esiEr)}`)),
      h('div', { class: 'card' + (cashAfter < 0 ? ' pay-warn' : '') }, h('small', { class: 'mu' }, 'Cash after paying salaries'), h('b', { class: 'big ' + (cashAfter < 0 ? 'neg' : '') }, money(cashAfter)), h('small', { class: 'mu block' }, cashAfter < 0 ? 'Not enough cash today. Collect invoices first.' : `of ${money(S.sum.cash)} in hand`)));
  };
  const inp = (id, key, ph) => { const x = h('input', { type: 'number', min: 0, step: 'any', value: inputs[id]?.[key] || '', placeholder: ph, disabled: !editable || !S.can('write'), 'aria-label': `${key} for ${S.employees.find((e) => e.id === id)?.name}`, oninput: (ev) => { (inputs[id] ||= {})[key] = ev.target.value; recalc(); } }); return x; };
  const rowsEls = (editable ? emps.map((e) => ({ id: e.id, name: e.name, code: e.code })) : stored.map((s) => ({ id: s.employee_id, name: s.employee.name, code: s.employee.code }))).map((e) => {
    const c = (cells[e.id] = { gross: h('span', {}), ded: h('span', {}), net: h('b', {}) });
    return h('tr', {}, td(h('b', {}, e.name), false), td(e.code || '-'), td(inp(e.id, 'lop', '0')), td(inp(e.id, 'bonus', '0')), td(inp(e.id, 'advance', '0')), td(inp(e.id, 'other_ded', '0')), td(inp(e.id, 'reimb', '0')), td(c.gross, true), td(c.ded, true), td(c.net, true));
  });
  cells.total = h('b', {});
  const stepper = h('ol', { class: 'stepper' }, ...[['Attendance', 'Enter unpaid days and one-off items'], ['Review', 'Check every payslip'], ['Approval', 'An admin approves'], ['Pay and file', 'Pay, then remit dues']].map(([t, s2], i) => h('li', { class: (step > i + 1 ? 'done' : '') + (step === i + 1 ? ' on' : '') }, h('i', {}, step > i + 1 ? icon('check', { size: 14 }) : String(i + 1)), h('div', {}, h('b', {}, t), h('small', { class: 'mu block' }, s2)))));
  const date = h('input', { type: 'date', value: payDate, disabled: !editable, 'aria-label': 'Pay date', onchange: (e) => { payDate = e.target.value; } });
  const dueIn = daysBetween(today(), d.salary);
  const actions = h('div', { class: 'acts wrap' },
    editable && S.can('write') && h('button', { onclick: () => A.saveRun(period, inputs, 'draft', payDate) }, 'Save draft'),
    editable && S.can('write') && h('button', { class: 'pri', onclick: () => { const bad = checks.slice(0, 1).filter((c) => !c.ok); if (bad.length) return toast('Add employees first', '', 'bad'); A.saveRun(period, inputs, 'pending', payDate); } }, 'Submit for approval'),
    rn?.status === 'draft' && S.can('write') && h('button', { onclick: () => confirm('Delete this draft?') && A.deleteRun(rn.id) }, 'Delete draft'),
    rn?.status === 'pending' && (admin ? [h('button', { class: 'pri', onclick: () => A.approveRun(rn.id) }, 'Approve payroll'), h('button', { onclick: () => { const n = prompt('Reason (shown to the preparer):', ''); if (n !== null) A.rejectRun(rn.id, n); } }, 'Send back')] : h('span', { class: 'mu' }, 'An admin needs to approve this run.')),
    rn?.status === 'approved' && admin && h('button', { class: 'pri', onclick: () => A.markRunPaid(rn.id, payDate < today() ? payDate : today()) }, 'Mark salaries paid'),
    rn && ['approved', 'paid'].includes(rn.status) && [h('button', { onclick: () => A.downloadPayroll(rn.id, 'payslip') }, 'All payslips (PDF)'), h('button', { onclick: () => A.downloadPayroll(rn.id, 'bank') }, 'Bank transfer file'), h('button', { onclick: () => A.downloadPayroll(rn.id, 'register') }, 'Payroll register'), h('button', { onclick: () => A.downloadPayroll(rn.id, 'ecr') }, 'PF ECR file')]);
  const out = h('div', { class: 'stack' },
    h('div', { class: 'row inv-bar' }, h('button', { 'aria-label': 'Previous month', onclick: () => { open(S, prevMonthOf(period)); A.render(); } }, icon('chevron-right', { size: 14, cls: 'flip' })), h('h3', { class: 'pay-month' }, monthName(period)), h('button', { 'aria-label': 'Next month', onclick: () => { open(S, nextMonth(period)); A.render(); } }, icon('chevron-right', { size: 14 })),
      h('span', { class: 'chip ' + ((rn ? ST[rn.status][1] : '')) }, rn ? ST[rn.status][0] : 'Not started'), h('span', { class: 'sp' }), h('small', { class: 'mu' }, rn?.status === 'paid' ? 'Paid' : dueIn >= 0 ? `Salaries due by ${d.salary} (${dueIn} day${dueIn === 1 ? '' : 's'})` : `Salaries were due ${d.salary}`), h('label', { class: 'inline' }, 'Pay date ', date)),
    stepper,
    rn?.note && rn.status === 'draft' && h('p', { class: 'al med' }, `Sent back: ${rn.note}`),
    checks.some((c) => !c.ok) && editable && card('Before you run payroll', ...checks.map((c) => h('div', { class: 'chk-row' }, h('i', { class: c.ok ? 'ok' : 'no', 'aria-hidden': 'true' }, icon(c.ok ? 'check' : 'minus', { size: 14 })), h('span', {}, c.label, !c.ok && h('small', { class: 'mu block' }, c.fix)), !c.ok && h('button', { class: 'sm', onclick: () => { tab = 'emp'; A.render(); } }, 'Fix')))),
    sumBox,
    card(editable ? 'Attendance and one-off items' : 'Payslips in this run', rowsEls.length ? table(['Employee', 'Code', 'Unpaid days', 'Bonus ₹', 'Advance recovery ₹', 'Other deduction ₹', 'Reimbursement ₹', 'Gross', 'Deductions', 'Net pay'], [...rowsEls, h('tr', { class: 'tot' }, ...Array(9).fill(0).map((_, i) => td(i === 0 ? h('b', {}, 'Total net pay') : '')), td(cells.total, true))], [7, 8, 9]) : h('p', { class: 'mu' }, 'No employees yet. Add your team in the Employees tab, or import a CSV.'),
      h('p', { class: 'mu small' }, 'PF, ESI, professional tax and TDS are calculated from each employee’s setup. Joiners and leavers are prorated automatically. Planning estimates: confirm with your CA.')),
    actions,
    rn && ['approved', 'paid'].includes(rn.status) && card('What you owe the authorities', table(['Due', 'Amount', 'By'], [['Provident fund (employee + employer)', rn.totals.pfTotal, d.pf], ['ESI', rn.totals.esiTotal, d.esi], ['Income tax (TDS)', rn.totals.tds, d.tds], ['Professional tax', rn.totals.pt, d.pt]].filter((r) => r[1] > 0).map(([n, a, by]) => h('tr', {}, td(n), td(money(a), true), td(by))), [1]),
      h('div', { class: 'acts' }, h('button', { onclick: () => A.showEntries(`-${period}`) }, 'See these in Transactions'), h('small', { class: 'mu' }, 'Mark each one paid there when you remit it. Paying on time earns XP.'))));
  recalc(); return out;
}

// ---------------------------------------------------------------- Employees
function empDialog(S, A, e = null) {
  const v = { pf_on: true, pf_cap: true, esi_on: false, tds_on: false, pt_state: 'none', ...(e || {}) }, f = {};
  const inp = (key, label, ex = {}) => { f[key] = h('input', { value: v[key] ?? '', ...ex }); return h('label', { class: ex.cls || '' }, label, f[key]); };
  const chk = (key, label) => { f[key] = h('input', { type: 'checkbox', checked: !!v[key], onchange: preview }); return h('label', { class: 'full chk' }, f[key], ' ' + label); };
  const pt = h('select', { 'aria-label': 'Professional tax state', onchange: preview }, ...Object.entries(PT_STATES).map(([k, n]) => h('option', { value: k, selected: v.pt_state === k }, n)));
  const box = h('div', { class: 'tax-preview-card' });
  const read = () => ({ code: f.code.value.trim() || null, name: f.name.value.trim(), designation: f.designation.value.trim() || null, email: f.email.value.trim() || null, phone: f.phone.value.trim() || null, join_date: f.join_date.value || null, pan: f.pan.value.trim().toUpperCase() || null, uan: f.uan.value.trim() || null, bank_acc: f.bank_acc.value.trim() || null, ifsc: f.ifsc.value.trim().toUpperCase() || null,
    basic: +f.basic.value || 0, hra: +f.hra.value || 0, allowances: +f.allowances.value || 0, pf_on: f.pf_on.checked, pf_cap: f.pf_cap.checked, esi_on: f.esi_on.checked, tds_on: f.tds_on.checked, tds_fixed: f.tds_fixed.value === '' ? null : +f.tds_fixed.value, pt_state: pt.value, pt_flat: +f.pt_flat.value || 0, active: v.active !== false, left_date: v.left_date || null });
  function preview() {
    const x = read(), c = calcPayslip(x, { days: 30, lop: 0, month: +today().slice(5, 7) });
    box.replaceChildren(h('h4', { class: 'tax-preview-title' }, icon('bolt', { size: 16 }), ' Monthly pay preview'),
      ...[['Gross', c.gross], ['PF (employee)', -c.pfEmp], ['ESI (employee)', -c.esiEmp], ['Professional tax', -c.pt], ['Income tax (TDS)', -c.tds]].map(([k, n]) => h('div', { class: 'tax-preview-row' }, h('span', {}, k), h('b', {}, (n < 0 ? '-' : '') + money(Math.abs(n))))),
      h('div', { class: 'tax-preview-divider' }), h('div', { class: 'tax-preview-row total' }, h('span', {}, 'Take-home'), h('b', { class: 'tax-grand-total' }, money(c.net))), h('small', { class: 'mu block' }, `Cost to company ${money(c.employerCost)} a month`));
  }
  const body = h('div', { class: 'emp-form' }, h('div', { class: 'form' },
    inp('name', 'Full name *', { required: true, cls: 'full' }), inp('code', 'Employee code', { placeholder: 'auto' }), inp('designation', 'Designation'), inp('join_date', 'Joining date', { type: 'date' }), inp('email', 'Email', { type: 'email' }), inp('phone', 'Phone'),
    inp('basic', 'Basic salary ₹ / month *', { type: 'number', min: 0, oninput: preview }), inp('hra', 'HRA ₹', { type: 'number', min: 0, oninput: preview }), inp('allowances', 'Other allowances ₹', { type: 'number', min: 0, oninput: preview }),
    chk('pf_on', 'Provident fund applies'), chk('pf_cap', 'Calculate PF on the ₹15,000 wage ceiling'), chk('esi_on', 'ESI applies (only if monthly gross is ₹21,000 or less)'), chk('tds_on', 'Deduct income tax (TDS) each month'),
    inp('tds_fixed', 'Fixed TDS ₹ / month (blank = estimate)', { type: 'number', min: 0, oninput: preview }), h('label', {}, 'Professional tax state', pt), inp('pt_flat', 'Flat professional tax ₹ (other states)', { type: 'number', min: 0 }),
    inp('pan', 'PAN', { maxLength: 10 }), inp('uan', 'UAN (12 digits)', { maxLength: 12 }), inp('bank_acc', 'Bank account number'), inp('ifsc', 'IFSC', { maxLength: 11 })), box);
  const close = dialog(e ? 'Edit employee' : 'Add employee', body,
    h('div', { class: 'acts' }, h('button', { onclick: () => close() }, 'Cancel'), h('button', { class: 'pri', onclick: async () => { const x = read(), errs = validateEmployee(x); if (errs.length) return toast('Check the details', errs[0], 'bad'); if (await A.saveEmployee(x, e?.id)) close(); } }, 'Save employee')));
  [f.basic, f.hra, f.allowances, f.tds_fixed].forEach((el) => { el.oninput = preview; }); [f.pf_on, f.pf_cap, f.esi_on, f.tds_on].forEach((el) => { el.onchange = preview; }); preview();
}
const TEMPLATE = 'code,name,designation,basic,hra,allowances,pf,esi,tds,pt_state,pan,uan,bank_acc,ifsc,join_date,email,phone\nE001,Asha Rao,Accountant,30000,12000,8000,yes,no,no,27,ABCDE1234F,100200300400,123456789012,HDFC0001234,2026-04-01,asha@example.com,9999999999\n';
function employees(S, A) {
  const w = S.can('write'), file = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: async (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; const r = parseEmployeesCsv(await f.text()); if (r.errors.length) toast(`${r.errors.length} row(s) skipped`, r.errors[0], 'bad'); if (r.rows.length) A.importEmployees(r.rows); } });
  return h('div', { class: 'stack' },
    h('div', { class: 'row inv-bar' }, h('h3', {}, `Employees (${S.employees.filter((e) => e.active !== false).length} active)`), h('span', { class: 'sp' }), file,
      w && h('button', { onclick: () => file.click() }, 'Import CSV'), h('button', { onclick: () => h('a', { href: URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })), download: 'employees-template.csv' }).click() }, 'CSV template'), w && h('button', { class: 'pri', onclick: () => empDialog(S, A) }, icon('plus', { size: 14 }), ' Add employee')),
    S.employees.length ? card('', table(['Code', 'Name', 'Gross / month', 'Applies', 'Missing', 'Status', ''], S.employees.map((e) => empRow(S, A, e, w)), [2]))
      : card('', h('p', { class: 'mu' }, 'No employees yet. Add each person, or import a CSV with the template.'), w && h('button', { class: 'pri', onclick: () => empDialog(S, A) }, 'Add your first employee')));
}
function empRow(S, A, e, w) {
  const m = [!e.pan && 'PAN', e.pf_on && !e.uan && 'UAN', !(e.bank_acc && e.ifsc) && 'bank'].filter(Boolean);
  return h('tr', {}, td(e.code), td(h('div', {}, h('b', {}, e.name), e.designation && h('small', { class: 'mu block' }, e.designation))), td(money(+e.basic + +e.hra + +e.allowances), true),
    td([e.pf_on && 'PF', e.esi_on && 'ESI', e.tds_on && 'TDS', e.pt_state !== 'none' && 'PT'].filter(Boolean).join(' · ') || '-'),
    td(m.length ? h('span', { class: 'chip warn' }, m.join(', ')) : h('span', { class: 'chip good' }, 'Complete')),
    td(e.active === false ? h('span', { class: 'chip' }, `Left ${e.left_date || ''}`) : h('span', { class: 'chip good' }, 'Active')),
    h('td', { class: 'acts' }, w && h('button', { onclick: () => empDialog(S, A, e) }, 'Edit'),
      w && (e.active === false ? h('button', { onclick: () => A.setEmployeeActive(e.id, true) }, 'Rejoin') : h('button', { onclick: () => confirm(`Mark ${e.name} as left today?`) && A.setEmployeeActive(e.id, false) }, 'Exit'))));
}

// ---------------------------------------------------------------- History and files, settings
function history(S, A) {
  return card(`Payroll history (${S.runs.length})`, S.runs.length ? table(['Month', 'Status', 'People', 'Net pay', 'Company cost', ''], S.runs.map((r) => h('tr', {}, td(h('b', {}, monthName(r.period))), td(h('span', { class: 'chip ' + ST[r.status][1] }, ST[r.status][0])), td(r.totals.headcount, true), td(money(r.totals.net), true), td(money(r.totals.employerCost), true),
    h('td', { class: 'acts' }, h('button', { onclick: () => { open(S, r.period); tab = 'run'; A.render(); } }, 'Open'), ['approved', 'paid'].includes(r.status) && h('button', { onclick: () => A.downloadPayroll(r.id, 'payslip') }, 'Payslips'), ['approved', 'paid'].includes(r.status) && h('button', { onclick: () => A.downloadPayroll(r.id, 'register') }, 'Register')))), [2, 3, 4]) : h('p', { class: 'mu' }, 'No payroll runs yet.'));
}
function settings(S, A) {
  const s = S.profile.payroll_settings || {}, ro = !S.can('admin'), v = {};
  const f = (k, label, ph = '') => { v[k] = h('input', { value: s[k] ?? '', placeholder: ph, disabled: ro }); return h('label', {}, label, v[k]); };
  return h('div', { class: 'grid2' },
    card('Registrations', h('p', { class: 'mu small' }, 'Printed on payroll files and used as reminders. We do not file anything for you.'), h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); A.savePayrollSettings(Object.fromEntries(Object.entries(v).map(([k, el]) => [k, el.value.trim()]).filter(([, x]) => x))); } },
      f('pf_code', 'PF establishment code'), f('esi_code', 'ESI code'), f('tan', 'TAN (for TDS)'), f('pay_day', 'Usual pay day of month', '28'), !ro && h('button', { class: 'pri full', type: 'submit' }, 'Save'))),
    card('Rates used', table(['Item', 'Rate'], [['PF employee and employer', `${PF.rate * 100}% of basic, wage ceiling ${money(PF.ceiling)}`], ['EPS (part of employer PF)', `${(PF.epsRate * 100).toFixed(2)}%, max ${money(PF.epsMax)}`], ['PF admin and EDLI', `${(PF.adminRate + PF.edliRate) * 100}% of PF wage`], ['ESI employee / employer', `${ESI.emp * 100}% / ${ESI.er * 100}% if gross is ${money(ESI.ceiling)} or less`], ['Salary due', '7th of the next month'], ['PF, ESI due', '15th of the next month']].map(([a, b]) => h('tr', {}, td(a), td(b)))), h('p', { class: 'mu small' }, 'Planning estimates. Rates, ceilings and state rules change: confirm with your CA before paying authorities.')));
}

export function payroll(S, A) {
  if (!S.can('write')) return card('Payroll is restricted', h('p', { class: 'mu' }, 'Only admins and finance can see salary data. Ask an admin for access.'));
  if (!period) open(S, defaultPeriod(S));
  const checks = payrollReadiness(S.employees, period, S.sum.cash, buildRun(S.employees, inputs, period).totals);
  return h('div', { class: 'stack' }, strip(S, checks), seg([['run', 'Run payroll'], ['emp', 'Employees'], ['hist', 'History'], ['set', 'Settings']], tab, (v) => { tab = v; A.render(); }),
    tab === 'run' ? run(S, A, checks) : tab === 'emp' ? employees(S, A) : tab === 'hist' ? history(S, A) : settings(S, A));
}
