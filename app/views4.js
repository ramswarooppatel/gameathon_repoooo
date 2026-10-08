// Invoicing: create GST tax invoices / bills of supply, e-way bill data, item catalog, and invoices received from other organisations.
import { h, inr, today, toast } from './util.js';
import { icon } from './icons.js';
import { validGstin } from '../tax/gst.js';
import { STATE_CODES, UNITS } from '../tax/config.js';
import { calcInvoice, nextNumber, validNumber, supplyFor, inWords, parseShared, exportInvoice } from '../tax/invoice.js';
import * as EW from '../tax/eway.js';
import { addDays } from '../workspace/calc.js';
import { money } from './invoice.js';

const SLABS = [0, 5, 12, 18, 28, 40];
const card = (title, ...kids) => h('section', { class: 'card' }, title && h('h3', {}, title), ...kids);
const table = (head, rows, right = []) => h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...head.map((t, i) => h('th', { class: right.includes(i) ? 'n' : '' }, t)))), h('tbody', {}, ...rows)));
const td = (v, right) => h('td', { class: right ? 'n' : '' }, v);
const fld = (label, el, cls = '') => h('label', { class: cls }, label, el);
const saveFile = (name, text, type = 'application/json') => h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }).click();

export function dialog(title, ...kids) {
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); }; const esc = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', esc); overlay.onclick = (e) => { if (e.target === overlay) close(); };
  overlay.append(h('div', { class: 'modal wide-modal' }, h('h2', {}, title), ...kids)); document.body.append(overlay);
  overlay.querySelector('input,select,button')?.focus();
  return close;
}

// ---------------------------------------------------------------- seller + status helpers
export function sellerOf(S) {
  const p = S.profile, s = p.invoice_settings || {};
  return { name: s.legal_name || p.name || '', gstin: p.gstin || '', address: s.address || '', city: s.city || '', pincode: s.pincode || '', phone: s.phone || '', email: s.email || '', bank: { name: s.bank_name || '', acc: s.bank_acc || '', ifsc: s.bank_ifsc || '', upi: s.upi || '' } };
}
export const linked = (S, inv) => S.entries.filter((e) => e.invoice_id === inv.id);
function statusOf(S, i) {
  if (i.status === 'draft') return ['Draft', ''];
  if (i.status === 'cancelled') return ['Cancelled', 'bad'];
  const rows = linked(S, i);
  if (rows.length && rows.every((e) => e.paid_date)) return ['Paid', 'good'];
  return i.due_date && i.due_date < today() ? ['Overdue', 'bad'] : ['Issued', 'info'];
}
export const asDoc = (S, i) => ({ ...i, paid: statusOf(S, i)[0] === 'Paid' });

// ---------------------------------------------------------------- form state (module level so typing never re-renders)
let F = null, tab = 'issued';
const blankLine = () => ({ desc: '', hsn: '', qty: 1, unit: 'NOS', rate: '', disc: 0, gst: 18 });
const blankBuyer = () => ({ name: '', gstin: '', address: '', city: '', pincode: '', email: '', phone: '' });
function newDraft(S) {
  const set = S.profile.invoice_settings || {}, date = today();
  return { id: null, doc_type: 'tax', number: nextNumber(S.invoices.map((i) => i.number), date, set.prefix || 'INV'), date, due_date: addDays(date, +set.due_days || 15), buyer: blankBuyer(), pos_state: (S.profile.gstin || '').slice(0, 2), reverse_charge: false, items: [blankLine()], notes: set.terms || '' };
}
const fromRow = (r) => ({ id: r.id, doc_type: r.doc_type, number: r.number, date: r.date, due_date: r.due_date || '', buyer: { ...blankBuyer(), ...r.buyer }, pos_state: r.pos_state || '', reverse_charge: r.reverse_charge, items: r.items.map((x) => ({ ...x })), notes: r.notes || '' });

export function startInvoice(S, buyerName = '') { F = newDraft(S); F.buyer.name = buyerName; const c = S.parties.find((p) => p.kind === 'customer' && p.name === buyerName); if (c) Object.assign(F.buyer, { gstin: c.gstin || '', address: c.address || '', pincode: c.pincode || '', email: c.email || '', phone: c.phone || '' }); tab = 'issued'; }
function build(S) {
  const seller = sellerOf(S), bos = F.doc_type === 'bos', supply = supplyFor(seller.gstin, F.pos_state);
  const items = F.items.filter((i) => String(i.desc).trim() || +i.rate).map((i) => ({ desc: String(i.desc).trim(), hsn: String(i.hsn).trim(), qty: +i.qty || 0, unit: i.unit, rate: +i.rate || 0, disc: +i.disc || 0, gst: bos ? 0 : +i.gst }));
  return { id: F.id, number: F.number.trim(), doc_type: F.doc_type, date: F.date, due_date: F.due_date || null, seller, buyer: { ...F.buyer, name: F.buyer.name.trim() }, buyer_gstin: F.buyer.gstin || null, supply, pos_state: F.pos_state || null, reverse_charge: F.reverse_charge, items, totals: calcInvoice(items, { supply, bos }), notes: F.notes.trim() || null };
}
function problems(d) {
  const e = [], tax = d.doc_type === 'tax';
  if (!d.buyer.name) e.push('Customer name is required.');
  if (d.buyer.gstin && !validGstin(d.buyer.gstin)) e.push('Customer GSTIN is not valid.');
  if (!validNumber(d.number)) e.push('Invoice number: up to 16 letters, digits, / or -.');
  if (d.due_date && d.due_date < d.date) e.push('Due date is before the invoice date.');
  if (tax && !validGstin(d.seller.gstin)) e.push('Add a valid company GSTIN in Settings, or choose Bill of supply.');
  if (!d.seller.name || !d.seller.address) e.push('Add your company address in Settings > Invoice details.');
  if (!d.items.length) e.push('Add at least one line.');
  d.items.forEach((i, k) => {
    if (!i.desc) e.push(`Line ${k + 1}: description is missing.`);
    if (!(i.qty > 0)) e.push(`Line ${k + 1}: quantity must be above 0.`);
    if (!(i.rate > 0)) e.push(`Line ${k + 1}: rate must be above 0.`);
    if (i.hsn && !/^\d{4,8}$/.test(i.hsn)) e.push(`Line ${k + 1}: HSN/SAC must be 4 to 8 digits.`);
  });
  return e;
}

// ---------------------------------------------------------------- the invoice form
function form(S, A) {
  const seller = sellerOf(S), customers = S.parties.filter((p) => p.kind === 'customer'), totalsBox = h('div', { class: 'inv-totals card' }), linesBox = h('div', { class: 'inv-lines' });
  const recalc = () => {
    const d = build(S), t = d.totals, bos = d.doc_type === 'bos', inter = d.supply === 'inter';
    totalsBox.replaceChildren(h('h3', {}, 'Summary'),
      ...[['Taxable value', t.taxable], ...(bos ? [] : inter ? [['IGST', t.igst]] : [['CGST', t.cgst], ['SGST', t.sgst]]), ...(t.roundOff ? [['Round off', t.roundOff]] : [])].map(([k, v]) => h('div', { class: 'up' }, h('span', {}, k), h('b', {}, money(v)))),
      h('div', { class: 'up inv-grand' }, h('span', {}, 'Total'), h('b', {}, money(t.payable))), h('small', { class: 'mu' }, inWords(t.payable)),
      h('small', { class: 'mu block' }, bos ? 'Bill of supply: no tax charged.' : d.supply === 'inter' ? 'Inter-state supply: IGST applies.' : 'Intra-state supply: CGST + SGST apply.'));
  };
  const inp = (obj, key, ex = {}) => h('input', { value: obj[key] ?? '', oninput: (e) => { obj[key] = e.target.value; ex.after?.(e); recalc(); }, ...ex.attrs });
  const pos = h('select', { onchange: (e) => { F.pos_state = e.target.value; recalc(); } }, h('option', { value: '' }, 'Select state'), ...Object.entries(STATE_CODES).map(([c, n]) => h('option', { value: c, selected: F.pos_state === c }, `${n} (${c})`)));
  const gst = h('input', { value: F.buyer.gstin, maxLength: 15, placeholder: '15-character GSTIN, blank if unregistered', oninput: (e) => { e.target.value = e.target.value.toUpperCase(); F.buyer.gstin = e.target.value; if (validGstin(e.target.value)) { F.pos_state = e.target.value.slice(0, 2); pos.value = F.pos_state; } hint.textContent = !e.target.value ? '' : validGstin(e.target.value) ? 'Valid GSTIN' : 'GSTIN checksum does not match'; recalc(); } });
  const hint = h('small', { class: 'mu' }), names = h('datalist', { id: 'inv-customers' }, ...customers.map((p) => h('option', { value: p.name })));
  const bName = h('input', { value: F.buyer.name, list: 'inv-customers', placeholder: 'Customer name', autocomplete: 'off', oninput: (e) => {
    F.buyer.name = e.target.value; const p = customers.find((x) => x.name === e.target.value);
    if (p) { Object.assign(F.buyer, { gstin: p.gstin || '', address: p.address || F.buyer.address, pincode: p.pincode || F.buyer.pincode, email: p.email || '', phone: p.phone || '' }); gst.value = F.buyer.gstin; gst.dispatchEvent(new Event('input')); bAddr.value = F.buyer.address; bPin.value = F.buyer.pincode; }
    recalc(); } });
  const bAddr = inp(F.buyer, 'address', { attrs: { placeholder: 'Address' } }), bPin = inp(F.buyer, 'pincode', { attrs: { maxLength: 6, placeholder: 'Pincode', inputMode: 'numeric' } });
  const type = h('select', { onchange: (e) => { F.doc_type = e.target.value; drawLines(); recalc(); } }, h('option', { value: 'tax', selected: F.doc_type === 'tax' }, 'Tax invoice'), h('option', { value: 'bos', selected: F.doc_type === 'bos' }, 'Bill of supply (no GST)'));
  const catalog = h('datalist', { id: 'inv-items' }, ...S.items.map((i) => h('option', { value: i.name })));

  function drawLines() {
    const bos = F.doc_type === 'bos';
    linesBox.replaceChildren(h('div', { class: 'inv-row inv-head', 'aria-hidden': 'true' }, ...['Item / service', 'HSN/SAC', 'Qty', 'Unit', 'Rate ₹', 'Disc %', bos ? '' : 'GST %', ''].map((t) => h('span', {}, t))),
      ...F.items.map((it, k) => {
        const hsn = inp(it, 'hsn', { attrs: { placeholder: 'HSN/SAC', inputMode: 'numeric', maxLength: 8, 'aria-label': 'HSN or SAC' } }), unit = h('select', { 'aria-label': 'Unit', onchange: (e) => { it.unit = e.target.value; } }, ...UNITS.map((u) => h('option', { value: u, selected: it.unit === u }, u)));
        const rate = inp(it, 'rate', { attrs: { type: 'number', min: 0, step: '0.01', placeholder: '0.00', 'aria-label': 'Rate' } }), g = h('select', { 'aria-label': 'GST rate', onchange: (e) => { it.gst = +e.target.value; recalc(); } }, ...SLABS.map((r) => h('option', { value: r, selected: +it.gst === r }, r + '%')));
        const desc = inp(it, 'desc', { attrs: { list: 'inv-items', placeholder: 'Item or service', 'aria-label': 'Description', autocomplete: 'off' }, after: (e) => { const c = S.items.find((x) => x.name === e.target.value); if (c) { Object.assign(it, { hsn: c.hsn || '', unit: c.unit, rate: c.rate, gst: +c.gst }); hsn.value = it.hsn; unit.value = it.unit; rate.value = it.rate; g.value = it.gst; } } });
        const last = inp(it, 'disc', { attrs: { type: 'number', min: 0, max: 100, step: '0.5', 'aria-label': 'Discount percent' } });
        const row = h('div', { class: 'inv-row' }, desc, hsn, inp(it, 'qty', { attrs: { type: 'number', min: 0, step: 'any', 'aria-label': 'Quantity' } }), unit, rate, last, bos ? h('span') : g,
          h('button', { type: 'button', class: 'ghost', title: 'Remove line', 'aria-label': 'Remove line', onclick: () => { if (F.items.length > 1) { F.items.splice(k, 1); drawLines(); recalc(); } } }, icon('x', { size: 14 })));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && e.target.tagName === 'INPUT') { e.preventDefault(); if (k === F.items.length - 1) { F.items.push(blankLine()); drawLines(); linesBox.querySelector('.inv-row:last-of-type input')?.focus(); } else row.nextElementSibling?.querySelector('input')?.focus(); } });
        return row;
      }));
  }
  const save = (status) => {
    const d = build(S), p = status === 'issued' ? problems(d) : (d.buyer.name ? [] : ['Customer name is required.']);
    if (p.length) return toast(status === 'issued' ? 'Fix before issuing' : 'Cannot save', p.slice(0, 3).join(' '), 'bad');
    if (status === 'issued' && !confirm(`Issue ${d.number} for ${money(d.totals.payable)}? An issued invoice cannot be edited, only cancelled.`)) return;
    A.saveInvoice(d, status).then((ok) => { if (ok) { F = null; tab = 'issued'; A.render(); } });
  };
  const root = h('div', { class: 'stack inv-form', onkeydown: (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save('draft'); } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save('issued'); } } },
    h('div', { class: 'row inv-bar' }, h('button', { type: 'button', onclick: () => { F = null; A.render(); } }, icon('arrow-right', { size: 14, cls: 'flip' }), ' Back'), h('span', { class: 'sp' }), h('small', { class: 'mu' }, 'Ctrl+S save draft · Ctrl+Enter issue'),
      h('button', { type: 'button', onclick: () => save('draft') }, 'Save draft'), h('button', { type: 'button', class: 'pri', onclick: () => save('issued') }, 'Issue invoice')),
    !validGstin(seller.gstin) && F.doc_type === 'tax' && h('p', { class: 'al med' }, 'Your company GSTIN is not set. Add it in Settings to issue GST tax invoices, or switch to Bill of supply.'),
    h('div', { class: 'inv-grid' },
      card('Invoice', h('div', { class: 'form' }, fld('Document', type), fld('Number', inp(F, 'number', { attrs: { maxLength: 16 } })), fld('Date', inp(F, 'date', { attrs: { type: 'date' } })), fld('Due date', inp(F, 'due_date', { attrs: { type: 'date' } })),
        fld('Place of supply', pos), h('label', { class: 'full chk' }, h('input', { type: 'checkbox', checked: F.reverse_charge, onchange: (e) => { F.reverse_charge = e.target.checked; } }), ' Reverse charge applies'))),
      card('Bill to', h('div', { class: 'form' }, fld('Customer', bName, 'full'), fld('GSTIN', gst), fld('Pincode', bPin), fld('Address', bAddr, 'full'), hint))),
    card('Items and services', names, catalog, linesBox, h('button', { type: 'button', onclick: () => { F.items.push(blankLine()); drawLines(); linesBox.querySelector('.inv-row:last-of-type input')?.focus(); } }, icon('plus', { size: 14 }), ' Add line')),
    h('div', { class: 'inv-grid' }, card('Notes and terms', h('textarea', { rows: 4, value: F.notes, placeholder: 'Payment terms, delivery notes…', oninput: (e) => { F.notes = e.target.value; } })), totalsBox));
  drawLines(); recalc(); return root;
}

// ---------------------------------------------------------------- dialogs: share, e-way, review received
function shareDialog(S, A, inv) {
  const d = asDoc(S, inv), t = inv.totals, b = inv.buyer, s = inv.seller, upi = s.bank?.upi;
  const msg = `Hi ${b.name}, invoice ${inv.number} dated ${inv.date} for ${money(t.payable)} from ${s.name}.${inv.due_date ? ` Due ${inv.due_date}.` : ''}${upi ? ` Pay by UPI: ${upi}.` : ''}`;
  const digits = String(b.phone || '').replace(/\D/g, ''), wa = digits.length === 10 ? '91' + digits : digits;
  const cloud = S.repo.mode === 'cloud', canSend = cloud && validGstin(inv.buyer_gstin) && inv.status === 'issued';
  const close = dialog('Share invoice ' + inv.number, h('p', { class: 'mu' }, `${b.name} · ${money(t.payable)}`), h('textarea', { rows: 3, readOnly: true, value: msg }),
    h('div', { class: 'acts wrap' },
      h('button', { onclick: async () => { try { await navigator.clipboard.writeText(msg); toast('Copied', 'Paste it anywhere.'); } catch { toast('Copy failed', 'Select the text and copy it.', 'bad'); } } }, 'Copy message'),
      wa && h('a', { class: 'btn', href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener' }, 'WhatsApp'),
      b.email && h('a', { class: 'btn', href: `mailto:${b.email}?subject=${encodeURIComponent('Invoice ' + inv.number)}&body=${encodeURIComponent(msg)}` }, 'Email'),
      h('button', { class: 'pri', onclick: () => A.downloadInvoicePdf(inv.id) }, 'Download PDF'),
      h('button', { onclick: () => { saveFile(`invoice-${inv.number.replace(/\W/g, '-')}.json`, exportInvoice(inv)); } }, 'Download invoice file'),
      h('button', { disabled: !canSend || inv.shared, onclick: async () => { await A.shareInvoice(inv.id); close(); } }, inv.shared ? `Sent to buyer (${inv.buyer_status || 'pending'})` : 'Send to buyer in the app')),
    h('p', { class: 'mu small' }, canSend ? `Delivers into the inbox of the workspace registered under GSTIN ${inv.buyer_gstin}, if there is one. They can accept or reject it.` : cloud ? 'To send into a buyer’s inbox, the invoice needs a valid buyer GSTIN.' : 'Demo mode has no other organisations. Send the invoice file; the buyer imports it under Invoices > Received.'),
    d.paid && h('p', { class: 'mu small' }, 'This invoice is marked paid.'), h('div', { class: 'acts' }, h('button', { onclick: () => close() }, 'Close')));
}

function ewayDialog(S, A, inv) {
  const ew = { mode: 'road', fromPincode: inv.seller.pincode || '', toPincode: inv.buyer.pincode || '', distance: '', vehicle: '', transporterId: '', transporterName: '', docNo: '', docDate: '', ewbNo: '', ...(inv.eway || {}) }, req = EW.required(inv);
  const valid = h('small', { class: 'mu block' }), upd = () => { valid.textContent = +ew.distance > 0 ? `Valid for ${EW.validityDays(ew.distance)} day(s), until ${EW.validUntil(inv.date, ew.distance)} (counted from generation date).` : ''; };
  const f = (label, key, ex = {}) => fld(label, h('input', { value: ew[key] ?? '', oninput: (e) => { ew[key] = ex.upper ? e.target.value.toUpperCase() : e.target.value; if (ex.upper) e.target.value = ew[key]; upd(); }, ...ex.attrs }));
  const close = dialog('E-way bill · ' + inv.number, h('p', { class: req.need ? 'al med' : 'mu' }, req.why),
    h('div', { class: 'form' }, f('Dispatch-from pincode', 'fromPincode', { attrs: { maxLength: 6, inputMode: 'numeric' } }), f('Ship-to pincode', 'toPincode', { attrs: { maxLength: 6, inputMode: 'numeric' } }), f('Distance (km)', 'distance', { attrs: { type: 'number', min: 1 } }),
      fld('Mode', h('select', { onchange: (e) => { ew.mode = e.target.value; } }, ...[['road', 'Road'], ['rail', 'Rail'], ['air', 'Air'], ['ship', 'Ship']].map(([v, l]) => h('option', { value: v, selected: ew.mode === v }, l)))),
      f('Vehicle number', 'vehicle', { upper: true, attrs: { placeholder: 'MH12AB1234' } }), f('Transporter GSTIN', 'transporterId', { upper: true, attrs: { maxLength: 15 } }), f('Transporter name', 'transporterName'), f('Transport doc / LR no.', 'docNo'), f('E-way bill number (after generating)', 'ewbNo', { attrs: { maxLength: 12, inputMode: 'numeric' } })),
    valid, h('p', { class: 'mu small' }, 'We prepare the data and a JSON file. Upload it at ewaybillgst.gov.in under Generate Bulk, then save the 12-digit number here so it prints on the invoice. Generating the bill itself needs your GST portal login.'),
    h('div', { class: 'acts' }, h('button', { onclick: () => close() }, 'Close'),
      h('button', { onclick: () => { const e = EW.check(ew); if (e.length) return toast('E-way details incomplete', e[0], 'bad'); saveFile(`eway-${inv.number.replace(/\W/g, '-')}.json`, JSON.stringify(EW.nicJson(inv, ew), null, 2)); } }, 'Download NIC JSON'),
      S.can('write') && h('button', { class: 'pri', onclick: async () => { if (ew.ewbNo && !/^\d{12}$/.test(ew.ewbNo)) return toast('E-way bill number', 'It has 12 digits.', 'bad'); await A.saveEway(inv.id, ew); close(); } }, 'Save')));
  upd();
}

function reviewDialog(S, A, doc, shared) {
  const t = doc.totals, mine = S.profile.gstin, wrongBuyer = doc.buyer?.gstin && mine && doc.buyer.gstin.toUpperCase() !== mine.toUpperCase(), dup = S.entries.some((e) => e.invoice_id === doc.id);
  const done = shared?.buyer_status === 'accepted' || dup, note = h('input', { placeholder: 'Reason (shown to the sender)' });
  const close = dialog(`Received invoice ${doc.number}`, h('p', {}, h('b', {}, doc.seller.name), ` · GSTIN ${doc.seller.gstin} `, h('span', { class: 'chip ' + (validGstin(doc.seller.gstin) ? 'good' : 'bad') }, validGstin(doc.seller.gstin) ? 'GSTIN valid' : 'GSTIN invalid')),
    h('p', { class: 'mu' }, `Dated ${doc.date}${doc.due_date ? ' · due ' + doc.due_date : ''} · ${doc.supply === 'inter' ? 'IGST' : 'CGST + SGST'} · total ${money(t.payable)}`),
    doc.mismatch && h('p', { class: 'al high' }, `The sender’s total differs from the recalculated total (${money(doc.mismatch)} vs ${money(t.grand)}). We use the recalculated figures.`),
    wrongBuyer && h('p', { class: 'al med' }, `This invoice is addressed to GSTIN ${doc.buyer.gstin}, not your company GSTIN.`),
    !validGstin(doc.seller.gstin) && h('p', { class: 'al med' }, 'Input tax credit needs a valid supplier GSTIN. This purchase will be recorded but its GST will not count as credit.'),
    table(['Item', 'HSN/SAC', 'Qty', 'GST', 'Taxable'], t.lines.map((l) => h('tr', {}, td(l.desc), td(l.hsn || '—'), td(`${l.qty} ${l.unit || ''}`, true), td(l.gst + '%', true), td(money(l.taxable), true))), [2, 3, 4]),
    h('p', { class: 'mu small' }, `Tax ${money(t.tax)} would be recorded as input credit${doc.reverse_charge ? ' (reverse charge: pay this tax yourself)' : ''}.`),
    done ? h('p', { class: 'al low' }, 'Already recorded in your books.') : S.can('write') ? h('div', { class: 'row' }, shared && note) : h('p', { class: 'mu' }, 'Your role is read-only.'),
    h('div', { class: 'acts' }, h('button', { onclick: () => close() }, 'Close'),
      !done && S.can('write') && shared && h('button', { onclick: async () => { await A.rejectInvoice(shared.id, note.value.trim()); close(); } }, 'Reject'),
      !done && S.can('write') && h('button', { class: 'pri', onclick: async () => { await A.acceptInvoice(doc, shared); close(); } }, 'Accept and record purchase')));
}

// ---------------------------------------------------------------- tabs
function issued(S, A) {
  const rows = [...S.invoices].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.number < b.number ? 1 : -1)), w = S.can('write');
  if (!rows.length) return card('', h('p', { class: 'mu' }, 'No invoices yet. Create your first GST tax invoice in under a minute.'), w && h('button', { class: 'pri', onclick: () => { F = newDraft(S); A.render(); } }, 'New invoice'));
  return card(`Invoices (${rows.length})`, table(['Number', 'Date', 'Customer', 'Total', 'Status', ''], rows.map((i) => {
    const [label, kind] = statusOf(S, i), live = i.status === 'issued';
    return h('tr', {}, td(i.number), td(i.date), td(i.buyer.name), td(money(i.totals.payable), true),
      td(h('span', { class: 'chip ' + kind }, label), false),
      h('td', { class: 'acts' },
        i.status === 'draft' ? [w && h('button', { onclick: () => { F = fromRow(i); A.render(); } }, 'Edit'), w && h('button', { onclick: () => confirm('Delete this draft?') && A.deleteDraft(i.id) }, 'Delete')]
          : [h('button', { onclick: () => A.openInvoice(i.id) }, 'View'), h('button', { onclick: () => A.downloadInvoicePdf(i.id) }, 'PDF'), h('button', { onclick: () => A.showEntries(i.number) }, 'Entries'), live && h('button', { onclick: () => shareDialog(S, A, i) }, 'Share'), live && i.doc_type === 'tax' && h('button', { onclick: () => ewayDialog(S, A, i) }, 'E-way'),
            live && w && label !== 'Paid' && h('button', { onclick: () => A.markInvoicePaid(i.id) }, 'Paid'), live && S.can('admin') && h('button', { onclick: () => confirm(`Cancel ${i.number}? Its sale entries are removed from your books.`) && A.cancelInvoice(i.id) }, 'Cancel')]));
  })));
}

// A shared row comes from another organisation's database: recompute its totals, never trust the stored ones.
const docFromRow = (i) => { const totals = calcInvoice(i.items, { supply: i.supply, bos: i.doc_type === 'bos' }); return { ...i, totals, mismatch: Math.abs(totals.grand - (+i.totals?.grand || totals.grand)) > 1 ? +i.totals.grand : 0 }; };
function received(S, A) {
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 1e6) return toast('File too large', 'Invoice files are under 1 MB.', 'bad');
    const r = parseShared(await f.text()); if (r.error) return toast('Cannot read this file', r.error, 'bad'); reviewDialog(S, A, r.doc, null); } });
  const rows = S.inbox;
  return card(`Received (${rows.length})`, h('p', { class: 'mu small' }, 'Invoices other organisations send to your GSTIN appear here. You can also import an invoice file from any Mind Your Funds user.'),
    S.can('write') && h('div', { class: 'acts' }, file, h('button', { onclick: () => file.click() }, icon('plus', { size: 14 }), ' Import invoice file')),
    rows.length ? table(['From', 'Number', 'Date', 'Total', 'Status', ''], rows.map((i) => h('tr', {}, td(i.seller.name), td(i.number), td(i.date), td(money(docFromRow(i).totals.payable), true), td(h('span', { class: 'chip ' + ({ accepted: 'good', rejected: 'bad' }[i.buyer_status] || 'warn') }, i.buyer_status || 'pending')), h('td', { class: 'acts' }, h('button', { onclick: () => reviewDialog(S, A, docFromRow(i), i) }, 'Review'))))) : h('p', { class: 'mu' }, S.repo.mode === 'cloud' ? 'Nothing received yet.' : 'Demo mode: import a file to try it.'));
}

function catalog(S, A) {
  const name = h('input', { placeholder: 'Item or service', required: true }), hsn = h('input', { placeholder: 'HSN/SAC', maxLength: 8 }), rate = h('input', { type: 'number', min: 0, step: '0.01', placeholder: 'Rate ₹' });
  const unit = h('select', {}, ...UNITS.map((u) => h('option', { value: u }, u))), g = h('select', {}, ...SLABS.map((r) => h('option', { value: r, selected: r === 18 }, r + '%')));
  return h('div', { class: 'stack' }, S.can('write') && card('Add item', h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); if (hsn.value && !/^\d{4,8}$/.test(hsn.value)) return toast('HSN/SAC', 'Use 4 to 8 digits.', 'bad'); A.saveItem({ name: name.value.trim(), hsn: hsn.value.trim() || null, unit: unit.value, rate: +rate.value || 0, gst: +g.value }); } }, name, hsn, unit, rate, g, h('button', { class: 'pri', type: 'submit' }, 'Save')), h('p', { class: 'mu small' }, 'Saved items autofill HSN, unit, rate and GST on every invoice.')),
    card(`Catalog (${S.items.length})`, S.items.length ? table(['Item', 'HSN/SAC', 'Unit', 'Rate', 'GST', ''], S.items.map((i) => h('tr', {}, td(i.name), td(i.hsn || '—'), td(i.unit), td(money(i.rate), true), td(i.gst + '%', true), h('td', { class: 'acts' }, S.can('write') && h('button', { 'aria-label': 'Remove ' + i.name, onclick: () => A.removeItem(i.id) }, icon('x', { size: 14 }))))), [3, 4]) : h('p', { class: 'mu' }, 'No items yet.')));
}

export function invoices(S, A) {
  if (F) return form(S, A);
  const w = S.can('write'), TABS = [['issued', 'Invoices'], ['received', `Received${S.inbox.filter((i) => !i.buyer_status || i.buyer_status === 'pending').length ? ' •' : ''}`], ['items', 'Items']];
  const open = S.invoices.filter((i) => i.status === 'issued' && statusOf(S, i)[0] !== 'Paid'), owed = open.reduce((s, i) => s + i.totals.payable, 0);
  return h('div', { class: 'stack' },
    h('div', { class: 'row inv-bar' }, h('div', { class: 'seg tabs-seg', role: 'tablist' }, ...TABS.map(([id, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), 'aria-pressed': String(tab === id), onclick: () => { tab = id; A.render(); } }, l))), h('span', { class: 'sp' }),
      h('small', { class: 'mu' }, `${open.length} unpaid · ${money(owed)} to collect`), w && h('button', { class: 'pri', onclick: () => { F = newDraft(S); A.render(); } }, icon('plus', { size: 14 }), ' New invoice')),
    { issued, received, items: catalog }[tab](S, A));
}

// ---------------------------------------------------------------- Settings card: seller details printed on every invoice
export function invoiceSettingsCard(S, A) {
  const s = S.profile.invoice_settings || {}, ro = !S.can('admin'), v = {};
  const f = (key, label, ex = {}) => { v[key] = h('input', { value: s[key] ?? '', disabled: ro, ...ex }); return fld(label, v[key], ex.cls || ''); };
  return card('Invoice details', h('p', { class: 'mu small' }, 'Printed on every invoice. GSTIN and company name come from Company profile.'),
    h('form', { class: 'form inv', onsubmit: (e) => { e.preventDefault(); const o = Object.fromEntries(Object.entries(v).map(([k, el]) => [k, el.value.trim()]).filter(([, x]) => x)); if (o.pincode && !EW.validPincode(o.pincode)) return toast('Pincode', 'Use 6 digits.', 'bad'); if (o.prefix) o.prefix = o.prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 5); A.saveProfile({ invoice_settings: o }); } },
      f('legal_name', 'Legal / trade name (if different)', { cls: 'full' }), f('address', 'Address', { cls: 'full' }), f('city', 'City'), f('pincode', 'Pincode', { maxLength: 6, inputMode: 'numeric' }), f('phone', 'Phone'), f('email', 'Email', { type: 'email' }),
      f('bank_name', 'Bank'), f('bank_acc', 'Account number'), f('bank_ifsc', 'IFSC'), f('upi', 'UPI ID'), f('prefix', 'Invoice prefix (up to 5 letters)', { maxLength: 5, placeholder: 'INV' }), f('due_days', 'Default payment terms (days)', { type: 'number', min: 0, max: 180, placeholder: '15' }),
      fld('Default notes and terms', (v.terms = h('textarea', { rows: 3, value: s.terms ?? '', disabled: ro })), 'full'), !ro && h('button', { class: 'pri full', type: 'submit' }, 'Save invoice details')));
}
