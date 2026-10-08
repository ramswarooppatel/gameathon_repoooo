// E-way bill helper. We prepare the data and the NIC bulk-upload JSON; the bill itself is generated on ewaybillgst.gov.in.
// Rules are simplified planning aids (state-wise exemptions exist): verify on the portal.
import { EWAY_THRESHOLD } from './config.js';
const dmy = (d) => d.split('-').reverse().join('/');
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export const validVehicle = (v) => /^[A-Z]{2}\d{2}[A-Z]{0,3}\d{4}$/.test((v || '').replace(/[\s-]/g, '').toUpperCase());
export const validPincode = (p) => /^[1-9]\d{5}$/.test(p || '');
// Services (SAC starts with 99) never need one.
export const isGoods = (items) => items.some((i) => !String(i.hsn || '').startsWith('99'));
export function required(inv) {
  const lim = '₹' + EWAY_THRESHOLD.toLocaleString('en-IN');
  if (!isGoods(inv.items)) return { need: false, why: 'Services do not need an e-way bill.' };
  if (inv.totals.grand <= EWAY_THRESHOLD) return { need: false, why: `Consignment value is not above ${lim}. Optional.` };
  return { need: true, why: `Goods worth more than ${lim} moving by road, rail, air or ship need an e-way bill.` };
}
// 1 day per 200 km (100 km for over-dimensional cargo), minimum 1 day.
export const validityDays = (km, odc = false) => Math.max(1, Math.ceil((+km || 0) / (odc ? 100 : 200)));
export const validUntil = (from, km, odc) => new Date(Date.parse(from) + validityDays(km, odc) * 86400000).toISOString().slice(0, 10);

export function check(ew) {
  const e = [];
  if (!validPincode(ew.fromPincode)) e.push('Dispatch-from pincode must be 6 digits.');
  if (!validPincode(ew.toPincode)) e.push('Ship-to pincode must be 6 digits.');
  if (!(+ew.distance > 0)) e.push('Approximate distance in km is required.');
  if (ew.mode === 'road' && !ew.transporterId && !validVehicle(ew.vehicle)) e.push('Enter a vehicle number (like MH12AB1234) or a transporter GSTIN.');
  if (ew.transporterId && !GSTIN.test(ew.transporterId)) e.push('Transporter ID must be a 15-character GSTIN.');
  return e;
}

// NIC "bulk generation" JSON (version 1.0.0621). Upload at ewaybillgst.gov.in > Generate Bulk.
export function nicJson(inv, ew) {
  const t = inv.totals, s = inv.seller, b = inv.buyer, inter = inv.supply === 'inter', to = +(inv.pos_state || b.gstin?.slice(0, 2) || 0), from = +s.gstin.slice(0, 2);
  const rate = (g) => (inter ? { sgstRate: 0, cgstRate: 0, igstRate: g } : { sgstRate: g / 2, cgstRate: g / 2, igstRate: 0 });
  return {
    version: '1.0.0621',
    billLists: [{
      userGstin: s.gstin, supplyType: 'O', subSupplyType: 1, docType: 'INV', docNo: inv.number, docDate: dmy(inv.date), transType: 1,
      fromGstin: s.gstin, fromTrdName: s.name, fromAddr1: (s.address || '').slice(0, 120), fromPlace: s.city || '', fromPincode: +ew.fromPincode, fromStateCode: from, actualFromStateCode: from,
      toGstin: b.gstin || 'URP', toTrdName: b.name, toAddr1: (b.address || '').slice(0, 120), toPlace: b.city || '', toPincode: +ew.toPincode, toStateCode: to, actualToStateCode: to,
      totalValue: t.taxable, cgstValue: t.cgst, sgstValue: t.sgst, igstValue: t.igst, cessValue: 0, totInvValue: t.grand,
      transporterId: ew.transporterId || '', transporterName: ew.transporterName || '', transDocNo: ew.docNo || '', transDocDate: ew.docDate ? dmy(ew.docDate) : '',
      transMode: { road: 1, rail: 2, air: 3, ship: 4 }[ew.mode] || 1, transDistance: Math.round(+ew.distance), vehicleNo: (ew.vehicle || '').replace(/[\s-]/g, '').toUpperCase(), vehicleType: 'R',
      itemList: t.lines.map((l) => ({ productName: l.desc, productDesc: l.desc, hsnCode: +String(l.hsn).replace(/\D/g, '') || 0, quantity: +l.qty, qtyUnit: l.unit || 'OTH', taxableAmount: l.taxable, ...rate(l.gst), cessRate: 0 })),
    }],
  };
}
