const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const r2 = (n) => Math.round(n * 100) / 100;

// Intra-state => CGST+SGST (rate/2 each); inter-state => IGST (full rate).
export function split(taxable, rate, supply) {
  const t = (taxable * rate) / 100;
  return supply === 'inter'
    ? { cgst: 0, sgst: 0, igst: r2(t), total: r2(t) }
    : { cgst: r2(t / 2), sgst: r2(t / 2), igst: 0, total: r2(t) };
}

export const supplyType = (g1, g2) => (g1.slice(0, 2) === g2.slice(0, 2) ? 'intra' : 'inter');

// GSTIN = state(2) + PAN(10) + entity(1) + 'Z' + checksum(1). Mod-36 checksum.
export function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CH.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CH[(36 - (sum % 36)) % 36];
}
export const makeGstin = (state, pan10, entity = '1') => {
  const f = `${state}${pan10}${entity}Z`;
  return f + gstinCheckChar(f);
};
export const validGstin = (g) =>
  /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(g || '') && gstinCheckChar(g.slice(0, 14)) === g[14];

// Net payable after ITC. Cross-utilisation: IGST credit -> IGST, CGST, SGST; CGST credit -> CGST, IGST; SGST credit -> SGST, IGST.
export function netPayable(output, itc) {
  const o = { ...output }, i = { ...itc };
  const use = (c, h) => { const u = Math.min(i[c], o[h]); i[c] -= u; o[h] -= u; };
  use('igst', 'igst'); use('igst', 'cgst'); use('igst', 'sgst');
  use('cgst', 'cgst'); use('cgst', 'igst');
  use('sgst', 'sgst'); use('sgst', 'igst');
  const total = r2(o.cgst + o.sgst + o.igst);
  return { payable: o, total, carry: i };
}
export const addHeads = (a, b) => ({ cgst: r2(a.cgst + b.cgst), sgst: r2(a.sgst + b.sgst), igst: r2(a.igst + b.igst) });
