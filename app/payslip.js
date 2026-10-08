// Payslip PDF: one A4 page per employee, built with the same dependency-free writer as invoices (Latin-1, rupee prints as "Rs.").
import { Pdf } from './pdf.js';
import { inWords } from '../tax/invoice.js';
import { monthName } from '../workspace/payroll.js';

const W = 595.28, M = 40, R = W - M, GREY = [110, 110, 110], HEAD = [240, 242, 245];
const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mask = (s) => (s ? 'XXXXXX' + String(s).slice(-4) : '-');

export function payslipPdf(run, slips, company = {}) {
  const d = new Pdf(), set = company.invoice_settings || {}, month = monthName(run.period);
  slips.forEach((s, idx) => {
    if (idx) d.addPage();
    const e = s.employee, c = s.calc; let y = M + 6;
    d.text(M, y + 10, company.name || '', { size: 16, bold: true }); d.text(R, y + 10, 'PAYSLIP', { size: 16, bold: true, align: 'right' });
    d.text(M, y + 25, [set.address, set.city].filter(Boolean).join(', '), { size: 9, color: GREY }); d.text(R, y + 25, month, { size: 10, bold: true, align: 'right' });
    y += 40; d.line(M, y, R, y, { color: [60, 60, 60], w: 1 }); y += 12;
    const bw = (R - M - 12) / 2; d.rect(M, y, bw, 78); d.rect(M + bw + 12, y, bw, 78);
    const kv = (x, yy, k, v) => { d.text(x, yy, k, { size: 8, color: GREY }); d.text(x + 78, yy, String(v || '-'), { size: 9, bold: true }); };
    kv(M + 8, y + 16, 'Employee', e.name); kv(M + 8, y + 31, 'Code', e.code); kv(M + 8, y + 46, 'Designation', e.designation); kv(M + 8, y + 61, 'Joined', e.join_date);
    const x2 = M + bw + 20; kv(x2, y + 16, 'PAN', e.pan); kv(x2, y + 31, 'UAN', e.uan); kv(x2, y + 46, 'Bank account', mask(e.bank_acc)); kv(x2, y + 61, 'Days paid', `${c.paidDays} of ${c.days}${c.lop ? ` (${c.lop} unpaid)` : ''}`);
    y += 94;
    const half = (R - M - 12) / 2, col = (x, title, rows, total, totalLabel) => {
      d.rect(x, y, half, 18, { fill: HEAD }); d.text(x + 8, y + 12, title.toUpperCase(), { size: 8, bold: true }); d.text(x + half - 8, y + 12, 'AMOUNT', { size: 8, bold: true, align: 'right' });
      let yy = y + 18; for (const [k, v] of rows) { yy += 18; d.text(x + 8, yy - 6, k, { size: 9 }); d.text(x + half - 8, yy - 6, money(v), { size: 9, align: 'right' }); d.line(x, yy, x + half, yy); }
      yy += 18; d.text(x + 8, yy - 6, totalLabel, { size: 9, bold: true }); d.text(x + half - 8, yy - 6, money(total), { size: 9, bold: true, align: 'right' }); return yy;
    };
    const a = col(M, 'Earnings', c.earnings, c.gross, 'Gross earnings'), b = col(M + half + 12, 'Deductions', c.deductions.length ? c.deductions : [['None', 0]], c.totalDeductions, 'Total deductions');
    y = Math.max(a, b) + 14;
    if (c.reimb) { d.text(M, y + 8, 'Reimbursements (not taxed)', { size: 9 }); d.text(R, y + 8, money(c.reimb), { size: 9, align: 'right' }); y += 18; }
    d.rect(M, y, R - M, 34, { fill: HEAD }); d.text(M + 10, y + 21, 'NET PAY', { size: 11, bold: true }); d.text(R - 10, y + 22, money(c.net), { size: 14, bold: true, align: 'right' }); y += 48;
    d.text(M, y + 8, 'Net pay in words: ' + inWords(c.net), { size: 9, bold: true }); y += 30;
    d.text(M, y + 8, 'EMPLOYER CONTRIBUTIONS (not deducted from your pay)', { size: 8, bold: true, color: GREY });
    d.text(M, y + 24, `Provident fund ${money(c.employer.pf)}   |   PF admin and EDLI ${money(c.employer.admin)}   |   ESI ${money(c.employer.esi)}`, { size: 9 }); y += 40;
    d.text(M, y + 8, 'Income tax (TDS) is an estimate under the new regime. Your final tax is settled in your return.', { size: 8, color: GREY });
    d.text(R, 800, 'Computer-generated payslip. No signature required.', { size: 8, color: GREY, align: 'right' });
    d.text(M, 800, `${company.name || ''}  |  ${month}  |  Page ${idx + 1} of ${slips.length}`, { size: 8, color: GREY });
  });
  return d.bytes();
}
