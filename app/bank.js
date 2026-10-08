// Bank statement import (CSV): parse + match to open invoices/bills. Pure, no DOM.
export function parseDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const num = (s) => { const v = parseFloat(String(s ?? '').replace(/[₹,\s]/g, '')); return Number.isFinite(v) ? v : 0; };

export function splitLine(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur].map((x) => x.trim());
}

// Positive amount = money in (credit), negative = money out (debit).
export function parseBank(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const hi = lines.findIndex((l) => /date/i.test(l) && /(debit|credit|amount|withdraw|deposit)/i.test(l));
  if (hi < 0) return [];
  const head = splitLine(lines[hi]).map((x) => x.toLowerCase()), col = (re) => head.findIndex((x) => re.test(x));
  const [cd, cn, cdr, ccr, cam] = [col(/date/), col(/(desc|narration|particular|remark|detail)/), col(/(debit|withdraw|\bdr\b)/), col(/(credit|deposit|\bcr\b)/), col(/amount/)];
  const rows = [];
  for (const l of lines.slice(hi + 1)) {
    const c = splitLine(l), date = parseDate(c[cd]);
    if (!date) continue;
    const amount = cdr >= 0 || ccr >= 0 ? num(c[ccr]) - num(c[cdr]) : num(c[cam]);
    if (amount) rows.push({ date, desc: c[cn] || '', amount });
  }
  return rows;
}

// rows: parsed bank rows. entries: enriched entries (with .total). Each entry is used at most once.
export function matchBank(rows, entries) {
  const used = new Set();
  return rows.map((row) => {
    const want = Math.abs(row.amount), inflow = row.amount > 0, d = row.desc.toLowerCase();
    const cands = entries.filter((e) => !e.paid_date && !used.has(e.id) && (inflow ? e.kind === 'sale' : e.kind !== 'sale') && Math.abs(e.total - want) <= 1);
    const hint = (e) => { const w = e.party.toLowerCase().split(' ')[0]; return w.length > 2 && d.includes(w); };
    cands.sort((a, b) => (hint(b) - hint(a)) || Math.abs(Date.parse(a.due_date || row.date) - Date.parse(row.date)) - Math.abs(Date.parse(b.due_date || row.date) - Date.parse(row.date)));
    const hit = cands[0] || null;
    if (hit) used.add(hit.id);
    return { row, entry: hit };
  });
}
