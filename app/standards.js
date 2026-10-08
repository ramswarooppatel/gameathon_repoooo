// Standards and obligations data. Pure: no DOM. Honest by design: "aligned" is never "certified".
import { validGstin } from '../tax/gst.js';
import { DEADLINES } from '../tax/config.js';
import { daysBetween } from '../workspace/calc.js';

// Recurring duties of an Indian small business. `due(ym)` returns the due date for that month, or null if the duty is not due that month.
const dom = (ym, d) => `${ym}-${String(d).padStart(2, '0')}`;
export const DUTIES = [
  { id: 'gstr1', label: 'GSTR-1 (sales return)', who: 'GST-registered', due: (ym) => dom(ym, DEADLINES.GSTR1), note: 'For last month’s sales. Due 11th.', go: 'compliance' },
  { id: 'gstr3b', label: 'GSTR-3B (summary and tax payment)', who: 'GST-registered', due: (ym) => dom(ym, DEADLINES.GSTR3B), note: 'Pay tax after ITC. Due 20th.', go: 'compliance' },
  { id: 'tds', label: 'Deposit TDS', who: 'If you deduct TDS', due: (ym) => dom(ym, DEADLINES.TDS), note: 'Deducted last month. Due 7th.' },
  { id: 'pf', label: 'Provident fund (PF)', who: '20 or more employees', due: (ym) => dom(ym, DEADLINES.PF), note: 'Due 15th.' },
  { id: 'esi', label: 'ESI contribution', who: '10 or more employees', due: (ym) => dom(ym, DEADLINES.ESI), note: 'Due 15th.' },
  { id: 'adv', label: 'Advance income tax', who: 'Tax over ₹10,000 a year', due: (ym) => (['06', '09', '12', '03'].includes(ym.slice(5)) ? dom(ym, 15) : null), note: '15 Jun, 15 Sep, 15 Dec, 15 Mar.' },
  { id: 'itr', label: 'Income tax return', who: 'Everyone with income', due: (ym) => (ym.slice(5) === '07' ? ym + '-31' : null), note: '31 Jul (31 Oct if audited).' },
  { id: 'gstr9', label: 'GSTR-9 annual return', who: 'GST-registered above the threshold', due: (ym) => (ym.slice(5) === '12' ? ym + '-31' : null), note: '31 Dec for the previous financial year.' },
  { id: 'pt', label: 'Professional tax', who: 'Depends on your state', due: (ym) => dom(ym, 30), note: 'Rules differ by state. Check yours.' },
];
export const dutyStatus = (due, done, today) => (done ? 'done' : due < today ? 'overdue' : daysBetween(today, due) <= 7 ? 'soon' : 'later');

// One-time setup items that auditors and banks ask for. Detected where the app can see it, otherwise ticked by hand.
export const registrations = [['udyam', 'Udyam (MSME) registration', 'Free; unlocks priority-sector loans and delayed-payment protection.'], ['shops', 'Shops and Establishment licence', 'State law; needed to operate premises.'], ['gstreg', 'GST registration', 'Needed above the turnover threshold or for inter-state sales.'], ['pan', 'Business PAN and current account', 'Keep business and personal money separate.']];

// How the platform meets each standard. status: built (done in the product), yours (needs your action), planned (not built), na.
export const CONTROLS = [
  { std: 'ISO/IEC 27001:2022', area: 'Information security', rows: [
    ['A.5.15 Access control', 'Three roles (admin, finance, viewer) enforced by the database, not just the screen.', 'built'],
    ['A.8.15 Logging', 'Every action is written to a SHA-256 hash-chained audit trail. Editing history breaks the chain.', 'built'],
    ['A.8.24 Cryptography', 'HTTPS in transit. Database encryption at rest is provided by Supabase.', 'built'],
    ['A.8.13 Backup', 'One-click full JSON backup. Download at least monthly.', 'yours'],
    ['A.8.5 Secure authentication', 'Email and password. Two-step sign-in is not offered yet.', 'planned'],
  ] },
  { std: 'ISO/IEC 27701 and DPDP Act 2023', area: 'Privacy', rows: [
    ['Consent and notice', 'Terms and privacy consent is recorded with a version at sign-up.', 'built'],
    ['Access and portability', 'Members can export their data as CSV and JSON.', 'built'],
    ['Data minimisation', 'The AI CFO receives totals only, never party names or invoice lines.', 'built'],
    ['Grievance officer and retention', 'Fill in your grievance officer, address and retention period on the legal pages.', 'yours'],
  ] },
  { std: 'ISO 9001:2015', area: 'Repeatable quality', rows: [
    ['Documented, repeatable process', 'Daily, weekly and month-end checklists with recorded completion.', 'built'],
    ['Records and traceability', 'Invoices are numbered per financial year, locked once issued, and cancelled instead of edited.', 'built'],
  ] },
  { std: 'ISO 8601 and ISO 4217', area: 'Data formats', rows: [['Dates and currency', 'Dates are stored as YYYY-MM-DD. Amounts are in INR (₹) with Indian digit grouping.', 'built']] },
  { std: 'ISO 20022', area: 'Bank data', rows: [['Bank statement formats', 'CSV import works. ISO 20022 camt.053 files are not read yet.', 'planned']] },
  { std: 'WCAG 2.2 level AA', area: 'Accessibility', rows: [
    ['Keyboard and screen reader', 'Skip link, labelled controls, visible focus, full keyboard shortcuts.', 'built'],
    ['Readable by everyone', 'Light and dark themes, text size, high contrast, reduced motion.', 'built'],
  ] },
  { std: 'CGST Act s.31 and Rules 46, 138', area: 'Tax documents', rows: [
    ['Tax invoice content', 'Supplier and buyer details, GSTIN, HSN/SAC, rate, tax by head, place of supply, reverse charge, unique number up to 16 characters.', 'built'],
    ['E-way bill', 'Requirement check, validity and NIC upload file. You generate the bill on the NIC portal.', 'built'],
    ['E-invoice (IRN)', 'Needed above the e-invoicing turnover limit. Not built.', 'planned'],
  ] },
  { std: 'RBI payment rules', area: 'Money movement', rows: [['No payments handled', 'The platform records and plans. It never holds or moves your money, so it needs no payment licence.', 'na']] },
  { std: 'IT Act 2000 and CERT-In directions', area: 'Incident response', rows: [['Report incidents in 6 hours', 'Name someone who will report a security incident. We cannot do that for you.', 'yours']] },
];

// Live checks on the company's own setup. Each returns {ok, label, fix?, go?}.
export function readiness(S, today, auditBroken) {
  const p = S.profile, set = p.invoice_settings || {}, last = localStorage.getItem('myf-last-backup');
  const admins = S.members.filter((m) => m.role === 'admin').length;
  return [
    { id: 'gstin', ok: validGstin(p.gstin), label: 'Company GSTIN is valid', fix: 'Add it in Settings', go: 'settings' },
    { id: 'invset', ok: !!(set.address && (set.bank_acc || set.upi)), label: 'Invoice address and bank or UPI are set', fix: 'Fill Invoice details in Settings', go: 'settings' },
    { id: 'chain', ok: auditBroken === 0, label: 'Audit trail integrity check passes', fix: auditBroken ? `Broken at entry ${auditBroken}` : 'Checking…', go: 'audit' },
    { id: 'backup', ok: !!last && daysBetween(last, today) <= 30, label: 'Backup downloaded in the last 30 days', fix: 'Settings > Full backup', go: 'settings' },
    { id: 'filings', ok: !S.filingsView.some((f) => f.status === 'overdue'), label: 'No overdue GST returns', fix: 'Open GST returns', go: 'compliance' },
    { id: 'limit', ok: +p.approval_limit > 0, label: 'Approval limit is set for spending', fix: 'Set it in Settings', go: 'settings' },
    { id: 'privilege', ok: S.members.length < 2 || admins < S.members.length, label: 'Not everyone is an admin (least privilege)', fix: 'Review Team & access', go: 'team' },
  ];
}
export const score = (checks) => Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
