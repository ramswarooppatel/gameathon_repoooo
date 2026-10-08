// Printable GST tax invoice (HTML string). Every dynamic value is escaped.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
