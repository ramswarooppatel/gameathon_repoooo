// Payroll runs: attendance to payslips, run totals, the entries a run creates, statutory due dates, file exports, CSV import. Pure.
import { calcPayslip } from '../tax/payroll.js';

const R = Math.round, pad = (n) => String(n).padStart(2, '0');
export const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };
export const prevMonthOf = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
export const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleString('en-IN', { month: 'long', year: 'numeric' });

export const EMP_RE = { pan: /^[A-Z]{5}\d{4}[A-Z]$/, uan: /^\d{12}$/, ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/, acc: /^\d{9,18}$/ };
export function validateEmployee(e) {
  const err = [];
  if (!String(e.name || '').trim()) err.push('Name is required.');
  if (!(+e.basic > 0)) err.push('Basic salary must be above 0.');
  if (e.pan && !EMP_RE.pan.test(e.pan)) err.push('PAN looks wrong (like ABCDE1234F).');
  if (e.uan && !EMP_RE.uan.test(e.uan)) err.push('UAN has 12 digits.');
  if (e.ifsc && !EMP_RE.ifsc.test(e.ifsc)) err.push('IFSC looks wrong (like HDFC0001234).');
  if (e.bank_acc && !EMP_RE.acc.test(e.bank_acc)) err.push('Account number has 9 to 18 digits.');
  if (e.join_date && !/^\d{4}-\d{2}-\d{2}$/.test(e.join_date)) err.push('Joining date must be a date.');
  return err;
}

// An employee is on this month's run if they joined on or before month end and have not left before month start.
export const onRun = (e, ym) => e.active !== false && (!e.join_date || e.join_date.slice(0, 7) <= ym) && (!e.left_date || e.left_date.slice(0, 7) >= ym);

// Days without pay caused by joining or leaving mid-month, on top of the attendance the user enters.
function autoLop(e, ym, days) {
  let n = 0;
  if (e.join_date && e.join_date.slice(0, 7) === ym) n += +e.join_date.slice(8) - 1;
  if (e.left_date && e.left_date.slice(0, 7) === ym) n += days - +e.left_date.slice(8);
  return n;
}

// inputs: { [employeeId]: { lop, bonus, other_earn, advance, other_ded, reimb } }
export function buildRun(employees, inputs, ym) {
  const days = daysInMonth(ym), month = +ym.slice(5);
  const slips = employees.filter((e) => onRun(e, ym)).map((e) => {
    const i = inputs[e.id] || {}, auto = autoLop(e, ym, days);
    const calc = calcPayslip(e, { days, lop: (+i.lop || 0) + auto, bonus: i.bonus, other_earn: i.other_earn, advance: i.advance, other_ded: i.other_ded, reimb: i.reimb, month });
    return { employee_id: e.id, employee: { code: e.code, name: e.name, designation: e.designation, pan: e.pan, uan: e.uan, bank_acc: e.bank_acc, ifsc: e.ifsc, join_date: e.join_date }, input: { lop: +i.lop || 0, bonus: +i.bonus || 0, other_earn: +i.other_earn || 0, advance: +i.advance || 0, other_ded: +i.other_ded || 0, reimb: +i.reimb || 0 }, calc, net: calc.net };
  });
  return { slips, totals: runTotals(slips) };
}

export function runTotals(slips) {
  const s = (f) => slips.reduce((a, x) => a + f(x.calc), 0);
  const pfEmp = s((c) => c.pfEmp), pfEr = s((c) => c.employer.pf), pfAdmin = s((c) => c.employer.admin), esiEmp = s((c) => c.esiEmp), esiEr = s((c) => c.employer.esi);
  return { headcount: slips.length, gross: s((c) => c.gross), net: s((c) => c.net), pfEmp, pfEr, pfAdmin, pfTotal: pfEmp + pfEr + pfAdmin, esiEmp, esiEr, esiTotal: esiEmp + esiEr, pt: s((c) => c.pt), tds: s((c) => c.tds), employerCost: s((c) => c.employerCost) };
}

// Salary is due by the 7th of the next month; PF and ESI by the 15th; TDS by the 7th; PT by month end of the next month (state rules differ).
export const dueDates = (ym) => { const n = nextMonth(ym), last = `${n}-${pad(daysInMonth(n))}`; return { salary: `${n}-07`, pf: `${n}-15`, esi: `${n}-15`, tds: `${n}-07`, pt: last }; };

// The books entries an approved run creates. Salary is the net pay; the rest are amounts owed to the authorities.
export function entriesFor(ym, totals, payDate) {
  const d = dueDates(ym), e = (kind, party, number, amount, due, cat) => ({ kind, party, number, gstin: null, category: cat, date: payDate, due_date: due, taxable: amount, gst_rate: 0, supply: 'intra', paid_date: null });
  return [e('salary', `Payroll ${ym}`, `PAY-${ym}`, totals.net, payDate, 'Salaries'),
    totals.pfTotal && e('expense', 'EPFO (provident fund)', `PF-${ym}`, totals.pfTotal, d.pf, 'Statutory dues'),
    totals.esiTotal && e('expense', 'ESIC', `ESI-${ym}`, totals.esiTotal, d.esi, 'Statutory dues'),
    totals.tds && e('expense', 'Income Tax Dept (TDS)', `TDS-${ym}`, totals.tds, d.tds, 'Statutory dues'),
    totals.pt && e('expense', 'Professional tax', `PT-${ym}`, totals.pt, d.pt, 'Statutory dues')].filter((x) => x && x.taxable > 0);
}

// On time when salary is paid by the 7th of the following month.
export const paidOnTime = (ym, payDate) => payDate <= dueDates(ym).salary;

// ---- exports (planning aids: check against the portal or your bank's format) ----
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const registerCsv = (slips) => ['Code,Name,Paid days,Gross,PF,ESI,PT,TDS,Other deductions,Reimbursement,Net pay,Employer cost',
  ...slips.map((x) => [q(x.employee.code), q(x.employee.name), x.calc.paidDays, x.calc.gross, x.calc.pfEmp, x.calc.esiEmp, x.calc.pt, x.calc.tds, x.calc.advance + x.calc.otherDed, x.calc.reimb, x.calc.net, x.calc.employerCost].join(','))].join('\n');
export const bankCsv = (slips, ym) => ['Beneficiary name,Account number,IFSC,Amount,Narration',
  ...slips.filter((x) => x.net > 0).map((x) => [q(x.employee.name), q(x.employee.bank_acc), q(x.employee.ifsc), x.net.toFixed(2), q('Salary ' + ym)].join(','))].join('\n');
// EPFO ECR v2 text: UAN#~#NAME#~#GROSS#~#EPF WAGES#~#EPS WAGES#~#EDLI WAGES#~#EPF#~#EPS#~#DIFF#~#NCP DAYS#~#REFUND
export const ecrText = (slips) => slips.filter((x) => x.calc.pfWage > 0).map((x) => { const c = x.calc, w = Math.min(c.pfWage, 15000); return [x.employee.uan || '', x.employee.name, c.gross, c.pfWage, w, w, c.pfEmp, c.employer.eps, c.employer.epf, c.lop, 0].join('#~#'); }).join('\n');

// ---- bulk import ----
const BOOL = (v, d) => (v === '' || v == null ? d : /^(y|yes|1|true)$/i.test(String(v).trim()));
export function parseEmployeesCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim()); if (lines.length < 2) return { rows: [], errors: ['Add a header row and at least one employee.'] };
  const split = (l) => { const o = []; let cur = '', inq = false; for (const ch of l) { if (ch === '"') inq = !inq; else if (ch === ',' && !inq) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o.map((x) => x.trim()); };
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, '')), rows = [], errors = [];
  lines.slice(1).forEach((l, i) => {
    const c = split(l), g = (k) => c[head.indexOf(k)] ?? '';
    const e = { code: g('code') || null, name: g('name'), designation: g('designation') || null, basic: +g('basic') || 0, hra: +g('hra') || 0, allowances: +g('allowances') || 0, pf_on: BOOL(g('pf'), true), pf_cap: true, esi_on: BOOL(g('esi'), false), tds_on: BOOL(g('tds'), false), pt_state: g('pt_state') || 'none', pan: g('pan').toUpperCase() || null, uan: g('uan') || null, bank_acc: g('bank_acc') || null, ifsc: g('ifsc').toUpperCase() || null, join_date: g('join_date') || null, email: g('email') || null, phone: g('phone') || null, active: true };
    const v = validateEmployee(e); if (v.length) errors.push(`Row ${i + 2}: ${v[0]}`); else rows.push(e);
  });
  return { rows, errors };
}

// Payroll streak: consecutive months, ending at the last completed month, where the run was paid on time.
export function payrollStreak(events, ym) {
  const ok = new Set(events.filter((e) => e.kind === 'payroll_on_time').map((e) => e.ref));
  let p = ok.has(ym) ? ym : prevMonthOf(ym), n = 0; while (ok.has(p)) { n++; p = prevMonthOf(p); }
  return n;
}

// Readiness checks shown before a run. Each: { ok, label, fix }.
export function payrollReadiness(employees, ym, cash, totals) {
  const act = employees.filter((e) => onRun(e, ym)), miss = (f) => act.filter((e) => !f(e)).length;
  return [
    { ok: act.length > 0, label: 'At least one active employee', fix: 'Add employees' },
    { ok: miss((e) => e.bank_acc && e.ifsc) === 0 && act.length > 0, label: 'Every employee has bank details', fix: `${miss((e) => e.bank_acc && e.ifsc)} missing` },
    { ok: miss((e) => !e.pf_on || e.uan) === 0 && act.length > 0, label: 'Every PF member has a UAN', fix: `${miss((e) => !e.pf_on || e.uan)} missing` },
    { ok: miss((e) => e.pan) === 0 && act.length > 0, label: 'Every employee has a PAN', fix: `${miss((e) => e.pan)} missing` },
    { ok: !totals || cash >= totals.net, label: 'Cash in hand covers net pay', fix: totals ? `Short by ${Math.round(totals.net - cash).toLocaleString('en-IN')}` : '' },
  ];
}
