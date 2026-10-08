// Printable GST invoices (HTML strings). Every dynamic value is escaped. taxInvoiceHtml = full invoice document; invoiceHtml = legacy one-line entries.
import { STATE_CODES } from '../tax/config.js';
import { inWords } from '../tax/invoice.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function invoiceHtml(e, org, party) {
  const t = e.tax, heads = e.supply === 'inter' ? [['IGST', t.igst]] : [['CGST', t.cgst], ['SGST', t.sgst]];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(e.number || '')}</title><style>
body{font:14px/1.5 system-ui,Segoe UI,sans-serif;color:#111;margin:40px;max-width:760px}h1{margin:0;font-size:22px}.row{display:flex;justify-content:space-between;gap:20px}
table{width:100%;border-collapse:collapse;margin:22px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}
.tot td{font-weight:700;border-top:2px solid #111}.mu{color:#666}.pill{display:inline-block;border:1px solid #0a7;color:#0a7;border-radius:99px;padding:1px 10px;font-size:12px}
@media print{button{display:none}}</style></head><body>
<div class="row"><div><h1>${esc(org.name)}</h1><div class="mu">GSTIN ${esc(org.gstin || 'not set')}</div></div><div style="text-align:right"><h1>TAX INVOICE</h1><div>No. ${esc(e.number || '—')}</div><div class="mu">Date ${esc(e.date)}${e.due_date ? ' · Due ' + esc(e.due_date) : ''}</div>${e.paid_date ? '<span class="pill">PAID ' + esc(e.paid_date) + '</span>' : ''}</div></div>
<p><b>Bill to</b><br>${esc(e.party)}<br><span class="mu">${e.gstin ? 'GSTIN ' + esc(e.gstin) : ''}${party?.email ? ' · ' + esc(party.email) : ''}${party?.phone ? ' · ' + esc(party.phone) : ''}</span></p>
<table><thead><tr><th>Description</th><th>Taxable value</th></tr></thead><tbody><tr><td>${esc(e.category || 'Goods / services')}</td><td>${inr(e.taxable)}</td></tr></tbody>
<tfoot>${heads.map(([n, v]) => `<tr><td>${n} @ ${esc(e.supply === 'inter' ? e.gst_rate : e.gst_rate / 2)}%</td><td>${inr(v)}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${inr(e.total)}</td></tr></tfoot></table>
<p class="mu">Place of supply: ${e.supply === 'inter' ? 'inter-state (IGST)' : 'intra-state (CGST + SGST)'}. This is a computer-generated invoice.</p>
<button onclick="print()">Print / Save as PDF</button></body></html>`;
}

const CSS = `body{font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:0;padding:24px;background:#eee}.pg{background:#fff;max-width:794px;margin:0 auto;padding:32px;box-shadow:0 2px 12px #0002}
h1{margin:0;font-size:20px}h2{margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#555}.row{display:flex;justify-content:space-between;gap:24px}.col{flex:1}.r{text-align:right}.mu{color:#555}.sm{font-size:12px}
table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:6px 8px;border:1px solid #ccc;text-align:left;vertical-align:top}th{background:#f3f3f3;font-size:12px}td.n,th.n{text-align:right;white-space:nowrap}
.tot td{font-weight:700}.box{border:1px solid #ccc;padding:8px 10px;border-radius:4px}.pill{display:inline-block;border:1px solid #0a7;color:#0a7;border-radius:99px;padding:1px 10px;font-size:12px}.void{border-color:#c00;color:#c00}
.bar{max-width:794px;margin:0 auto 12px;display:flex;gap:8px}.bar button{padding:8px 16px;border-radius:99px;border:1px solid #888;background:#fff;cursor:pointer;font:inherit}
@media print{body{background:#fff;padding:0}.pg{box-shadow:none;max-width:none;padding:0}.bar{display:none}}@page{size:A4;margin:14mm}`;
const addr = (p) => [p.address, p.city, [STATE_CODES[(p.state || p.gstin || '').slice(0, 2)], p.pincode].filter(Boolean).join(' ')].filter(Boolean).map(esc).join('<br>');

export function taxInvoiceHtml(inv, org = {}) {
  const t = inv.totals, s = inv.seller || {}, b = inv.buyer || {}, bos = inv.doc_type === 'bos', inter = inv.supply === 'inter', ew = inv.eway;
  const heads = inter ? [['IGST', 'igst']] : [['CGST', 'cgst'], ['SGST', 'sgst']];
  const title = bos ? 'BILL OF SUPPLY' : 'TAX INVOICE', pos = STATE_CODES[inv.pos_state] ? `${STATE_CODES[inv.pos_state]} (${inv.pos_state})` : '—';
  const bank = s.bank || {};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} ${esc(inv.number)}</title><style>${CSS}</style></head><body>
<div class="bar"><button onclick="print()">Print / Save as PDF</button></div><div class="pg">
<div class="row"><div class="col"><h1>${esc(s.name || org.name)}</h1><div class="sm mu">${addr(s)}${s.gstin ? '<br>GSTIN: <b>' + esc(s.gstin) + '</b>' : ''}${s.phone ? '<br>Phone: ' + esc(s.phone) : ''}${s.email ? ' · ' + esc(s.email) : ''}</div></div>
<div class="col r"><h1>${title}</h1><div>No. <b>${esc(inv.number)}</b></div><div class="mu">Date ${esc(inv.date)}${inv.due_date ? ' · Due ' + esc(inv.due_date) : ''}</div>${inv.status === 'cancelled' ? '<span class="pill void">CANCELLED</span>' : inv.paid ? '<span class="pill">PAID</span>' : ''}</div></div>
<div class="row" style="margin-top:14px"><div class="col box"><h2>Bill to</h2><b>${esc(b.name)}</b><div class="sm">${addr(b)}${b.gstin ? '<br>GSTIN: ' + esc(b.gstin) : '<br>Unregistered'}</div></div>
<div class="col box"><h2>Supply</h2><div class="sm">Place of supply: <b>${esc(pos)}</b><br>${bos ? 'No tax charged' : inter ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}<br>Reverse charge: <b>${inv.reverse_charge ? 'Yes' : 'No'}</b>${ew?.ewbNo ? '<br>E-way bill: <b>' + esc(ew.ewbNo) + '</b>' : ''}</div></div></div>
<table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Disc %</th>${bos ? '' : '<th class="n">GST %</th>'}<th class="n">Taxable</th></tr></thead><tbody>
${t.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.desc)}</td><td>${esc(l.hsn)}</td><td class="n">${esc(l.qty)} ${esc(l.unit || '')}</td><td class="n">${money(l.rate)}</td><td class="n">${l.disc ? esc(l.disc) : '—'}</td>${bos ? '' : `<td class="n">${esc(l.gst)}</td>`}<td class="n">${money(l.taxable)}</td></tr>`).join('')}
</tbody></table>
<div class="row"><div class="col">${bos ? '' : `<table class="sm"><thead><tr><th>HSN/SAC</th><th class="n">Taxable</th><th class="n">Rate</th>${heads.map(([n]) => `<th class="n">${n}</th>`).join('')}</tr></thead><tbody>${t.hsn.map((g) => `<tr><td>${esc(g.hsn)}</td><td class="n">${money(g.taxable)}</td><td class="n">${esc(g.gst)}%</td>${heads.map(([, k]) => `<td class="n">${money(g[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`}</div>
<div class="col" style="max-width:280px"><table><tbody><tr><td>Taxable value</td><td class="n">${money(t.taxable)}</td></tr>${bos ? '' : heads.map(([n, k]) => `<tr><td>${n}</td><td class="n">${money(t[k])}</td></tr>`).join('')}${t.roundOff ? `<tr><td>Round off</td><td class="n">${money(t.roundOff)}</td></tr>` : ''}<tr class="tot"><td>Total</td><td class="n">${money(t.payable)}</td></tr></tbody></table></div></div>
<p class="sm"><b>Amount in words:</b> ${esc(inWords(t.payable))}</p>
<div class="row sm"><div class="col">${bank.acc || bank.upi ? `<h2>Pay to</h2>${bank.name ? esc(bank.name) + '<br>' : ''}${bank.acc ? 'A/c ' + esc(bank.acc) + (bank.ifsc ? ' · IFSC ' + esc(bank.ifsc) : '') + '<br>' : ''}${bank.upi ? 'UPI: ' + esc(bank.upi) : ''}` : ''}${inv.notes ? `<h2 style="margin-top:10px">Notes and terms</h2><div style="white-space:pre-wrap">${esc(inv.notes)}</div>` : ''}</div>
<div class="col r" style="align-self:flex-end"><br><br>For <b>${esc(s.name || org.name)}</b><br><br><span class="mu">Authorised signatory</span></div></div>
<p class="sm mu" style="margin-top:18px">This is a computer-generated ${bos ? 'bill of supply' : 'tax invoice'}.</p></div></body></html>`;
}
