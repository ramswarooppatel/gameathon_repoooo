// Tiny dependency-free PDF writer (A4, built-in Helvetica) and the GST invoice layout. Pure: runs in the browser and in Node.
// Built-in fonts have no rupee sign, so amounts print as "Rs." Text is Latin-1; anything else becomes "?".
import { STATE_CODES } from '../tax/config.js';
import { inWords } from '../tax/invoice.js';

const W = 595.28, H = 841.89;
const REG = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'.split(' ').map(Number);
export const textWidth = (s, size, bold = false) => [...s].reduce((a, c) => a + (REG[c.charCodeAt(0) - 32] ?? 556), 0) * size * (bold ? 1.05 : 1) / 1000;
const clean = (s) => String(s ?? '').replace(/₹/g, 'Rs. ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, '|').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
const esc = (s) => clean(s).replace(/[\\()]/g, '\\$&');
const n2 = (n) => (+n).toFixed(2);

export function wrap(s, max, size, bold) {
  const out = [];
  for (const para of String(s ?? '').split('\n').map(clean)) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (textWidth(t, size, bold) <= max || !line) line = t; else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

export class Pdf {
  constructor() { this.pages = [[]]; }
  get cur() { return this.pages[this.pages.length - 1]; }
  addPage() { this.pages.push([]); }
  color(c, stroke) { return c.map((v) => n2(v / 255)).join(' ') + (stroke ? ' RG' : ' rg'); }
  text(x, y, s, { size = 10, bold = false, align = 'left', color = [17, 17, 17] } = {}) {      // y = baseline measured from the top
    const w = textWidth(clean(s), size, bold), px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.cur.push(`BT ${this.color(color)} /${bold ? 'F2' : 'F1'} ${size} Tf ${n2(px)} ${n2(H - y)} Td (${esc(s)}) Tj ET`);
  }
  line(x1, y1, x2, y2, { w = 0.6, color = [200, 200, 200] } = {}) { this.cur.push(`${this.color(color, true)} ${w} w ${n2(x1)} ${n2(H - y1)} m ${n2(x2)} ${n2(H - y2)} l S`); }
  rect(x, y, w, h, { fill, stroke = [200, 200, 200] } = {}) {
    this.cur.push(`${fill ? this.color(fill) + ' ' : ''}${stroke ? this.color(stroke, true) + ' 0.6 w ' : ''}${n2(x)} ${n2(H - y - h)} ${n2(w)} ${n2(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
  }
  // Assemble the file. Every character is <= 0xFF, so string offsets equal byte offsets.
  bytes() {
    const objs = [], add = (s) => objs.push(s) && objs.length;
    const n = this.pages.length, first = 5;                                           // 1 catalog, 2 pages, 3 F1, 4 F2, then page/content pairs
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(`<< /Type /Pages /Kids [${this.pages.map((_, i) => `${first + i * 2} 0 R`).join(' ')}] /Count ${n} >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.pages.forEach((ops, i) => {
      const body = ops.join('\n');
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(W)} ${n2(H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${first + i * 2 + 1} 0 R >>`);
      add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    });
    let out = '%PDF-1.4\n', offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255;
    return u;
  }
}

const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GREY = [110, 110, 110], HEAD = [240, 242, 245], M = 40, R = W - M;

// inv: an invoice document (seller, buyer, items, totals, supply, number, date, due_date, notes, doc_type, status, paid, reverse_charge, eway, pos_state)
export function invoicePdf(inv) {
  const d = new Pdf(), t = inv.totals, s = inv.seller || {}, b = inv.buyer || {}, bos = inv.doc_type === 'bos', inter = inv.supply === 'inter';
  const heads = inter ? [['IGST', 'igst']] : [['CGST', 'cgst'], ['SGST', 'sgst']];
  let y = M + 6;
  const title = bos ? 'BILL OF SUPPLY' : 'TAX INVOICE';
  // header
  d.text(M, y + 10, s.name || '', { size: 16, bold: true }); d.text(R, y + 10, title, { size: 16, bold: true, align: 'right' });
  let ly = y + 26; for (const l of wrap([s.address, s.city, [STATE_CODES[(s.gstin || '').slice(0, 2)], s.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', '), 280, 9)) { d.text(M, ly, l, { size: 9, color: GREY }); ly += 12; }
  if (s.gstin) { d.text(M, ly, 'GSTIN: ' + s.gstin, { size: 9, bold: true }); ly += 12; }
  const contact = [s.phone, s.email].filter(Boolean).join(' | '); if (contact) { d.text(M, ly, contact, { size: 9, color: GREY }); ly += 12; }
  let ry = y + 28; d.text(R, ry, 'No. ' + inv.number, { size: 10, bold: true, align: 'right' }); ry += 13;
  d.text(R, ry, 'Date: ' + inv.date + (inv.due_date ? '    Due: ' + inv.due_date : ''), { size: 9, color: GREY, align: 'right' }); ry += 13;
  if (inv.status === 'cancelled') d.text(R, ry, 'CANCELLED', { size: 10, bold: true, align: 'right', color: [200, 30, 30] });
  else if (inv.paid) d.text(R, ry, 'PAID', { size: 10, bold: true, align: 'right', color: [20, 130, 70] });
  y = Math.max(ly, ry) + 8; d.line(M, y, R, y, { color: [60, 60, 60], w: 1 }); y += 12;
  // parties
  const bw = (R - M - 12) / 2, bl = [b.address, b.city, [STATE_CODES[(b.gstin || '').slice(0, 2)], b.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const billLines = wrap(bl, bw - 16, 9), boxH = Math.max(80, 40 + billLines.length * 12 + 14);
  d.rect(M, y, bw, boxH); d.rect(M + bw + 12, y, bw, boxH);
  d.text(M + 8, y + 14, 'BILL TO', { size: 8, bold: true, color: GREY }); d.text(M + 8, y + 28, b.name || '', { size: 10, bold: true });
  billLines.forEach((l, i) => d.text(M + 8, y + 41 + i * 12, l, { size: 9, color: GREY })); d.text(M + 8, y + 41 + billLines.length * 12, b.gstin ? 'GSTIN: ' + b.gstin : 'Unregistered', { size: 9 });
  const sx = M + bw + 20, pos = STATE_CODES[inv.pos_state] ? `${STATE_CODES[inv.pos_state]} (${inv.pos_state})` : '-';
  d.text(sx, y + 14, 'SUPPLY', { size: 8, bold: true, color: GREY }); d.text(sx, y + 28, 'Place of supply: ' + pos, { size: 9 });
  d.text(sx, y + 41, bos ? 'No tax charged' : inter ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)', { size: 9, color: GREY });
  d.text(sx, y + 53, 'Reverse charge: ' + (inv.reverse_charge ? 'Yes' : 'No'), { size: 9, color: GREY }); if (inv.eway?.ewbNo) d.text(sx, y + 65, 'E-way bill: ' + inv.eway.ewbNo, { size: 9, bold: true });
  y += boxH + 14;
  // items table
  const cols = bos ? [['#', 18, 'l'], ['Description', 215, 'l'], ['HSN/SAC', 62, 'l'], ['Qty', 55, 'r'], ['Rate', 70, 'r'], ['Disc %', 40, 'r'], ['Taxable', 55, 'r']] : [['#', 18, 'l'], ['Description', 175, 'l'], ['HSN/SAC', 58, 'l'], ['Qty', 50, 'r'], ['Rate', 62, 'r'], ['Disc %', 36, 'r'], ['GST %', 34, 'r'], ['Taxable', 62, 'r']];
  const scale = (R - M) / cols.reduce((a, c) => a + c[1], 0), xs = []; let cx = M; for (const c of cols) { xs.push(cx); cx += c[1] * scale; }
  const cell = (i, str, yy, o = {}) => { const c = cols[i], w = c[1] * scale; d.text(c[2] === 'r' ? xs[i] + w - 5 : xs[i] + 5, yy, str, { size: 9, align: c[2] === 'r' ? 'right' : 'left', ...o }); };
  const head = () => { d.rect(M, y, R - M, 18, { fill: HEAD }); cols.forEach((c, i) => cell(i, c[0], y + 12, { bold: true, size: 8 })); y += 18; };
  head();
  t.lines.forEach((l, k) => {
    const desc = wrap(l.desc, cols[1][1] * scale - 10, 9), rh = Math.max(1, desc.length) * 12 + 8;
    if (y + rh > H - 150) { d.addPage(); y = M; head(); }
    cell(0, String(k + 1), y + 13); desc.forEach((x, i) => d.text(xs[1] + 5, y + 13 + i * 12, x, { size: 9 }));
    cell(2, l.hsn || '-', y + 13); cell(3, `${l.qty} ${l.unit || ''}`.trim(), y + 13); cell(4, n2(l.rate), y + 13); cell(5, l.disc ? String(l.disc) : '-', y + 13);
    if (!bos) cell(6, String(l.gst), y + 13); cell(cols.length - 1, n2(l.taxable), y + 13);
    y += rh; d.line(M, y, R, y);
  });
  y += 14;
  if (y > H - 190) { d.addPage(); y = M; }
  // totals (right) and HSN summary (left)
  const tx = R - 210, rows = [['Taxable value', t.taxable], ...(bos ? [] : heads.map(([n, k]) => [n, t[k]])), ...(t.roundOff ? [['Round off', t.roundOff]] : [])];
  let ty = y; for (const [k, v] of rows) { d.text(tx, ty + 10, k, { size: 9, color: GREY }); d.text(R, ty + 10, money(v), { size: 9, align: 'right' }); ty += 16; }
  d.line(tx, ty + 2, R, ty + 2, { color: [60, 60, 60], w: 1 }); d.text(tx, ty + 16, 'Total', { size: 11, bold: true }); d.text(R, ty + 16, money(t.payable), { size: 11, bold: true, align: 'right' }); ty += 24;
  let hy = y;
  if (!bos) {
    const hw = tx - M - 16; d.text(M, hy + 8, 'HSN / SAC SUMMARY', { size: 8, bold: true, color: GREY }); hy += 14;
    d.rect(M, hy, hw, 15, { fill: HEAD }); d.text(M + 4, hy + 10, 'HSN/SAC', { size: 8, bold: true }); d.text(M + hw * 0.5, hy + 10, 'Taxable', { size: 8, bold: true, align: 'right' }); d.text(M + hw * 0.62, hy + 10, 'Rate', { size: 8, bold: true, align: 'right' }); d.text(M + hw - 4, hy + 10, heads.map(([n]) => n).join('+'), { size: 8, bold: true, align: 'right' }); hy += 15;
    for (const g of t.hsn) { d.text(M + 4, hy + 11, g.hsn || '-', { size: 8 }); d.text(M + hw * 0.5, hy + 11, n2(g.taxable), { size: 8, align: 'right' }); d.text(M + hw * 0.62, hy + 11, g.gst + '%', { size: 8, align: 'right' }); d.text(M + hw - 4, hy + 11, n2(heads.reduce((a, [, k]) => a + g[k], 0)), { size: 8, align: 'right' }); hy += 15; d.line(M, hy, M + hw, hy); }
  }
  y = Math.max(ty, hy) + 10;
  for (const l of wrap('Amount in words: ' + inWords(t.payable), R - M, 9, false)) { d.text(M, y + 8, l, { size: 9, bold: true }); y += 12; }
  y += 8;
  const bank = s.bank || {}, pay = [bank.name, bank.acc && 'A/c ' + bank.acc + (bank.ifsc ? '  IFSC ' + bank.ifsc : ''), bank.upi && 'UPI: ' + bank.upi].filter(Boolean);
  if (pay.length) { d.text(M, y + 8, 'PAY TO', { size: 8, bold: true, color: GREY }); pay.forEach((l, i) => d.text(M, y + 21 + i * 12, l, { size: 9 })); y += 21 + pay.length * 12; }
  if (inv.notes) { y += 6; d.text(M, y + 8, 'NOTES AND TERMS', { size: 8, bold: true, color: GREY }); y += 8; for (const l of wrap(inv.notes, R - M, 9)) { if (y > H - 90) { d.addPage(); y = M; } d.text(M, y + 13, l, { size: 9 }); y += 12; } }
  const sy = Math.min(Math.max(y + 30, H - 110), H - 80);
  d.text(R, sy, 'For ' + (s.name || ''), { size: 9, bold: true, align: 'right' }); d.text(R, sy + 34, 'Authorised signatory', { size: 8, color: GREY, align: 'right' });
  const total = d.pages.length;
  for (let i = 0; i < total; i++) { d.pages[i].push(`BT 0.43 0.43 0.43 rg /F1 8 Tf ${n2(M)} 28 Td (${esc(`Computer-generated ${bos ? 'bill of supply' : 'tax invoice'} ${inv.number}  |  Page ${i + 1} of ${total}`)}) Tj ET`); }
  return d.bytes();
}
