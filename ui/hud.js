import { netPayable } from '../tax/gst.js';
import { inr } from '../agents/card.js';

const $ = (id) => document.getElementById(id);

export function renderHud(s, ghost) {
  $('h-day').textContent = s.day; $('h-cash').textContent = inr(s.cash); $('h-run').textContent = s.runwayDays;
  $('h-health').textContent = s.health; $('h-ghealth').textContent = ghost.health;
  $('b-you').style.width = s.health + '%'; $('b-ghost').style.width = ghost.health + '%';
  $('h-cash').style.color = s.cash < 20000 ? 'var(--bad)' : '';
  $('h-react').textContent = s.stats.decisions ? (s.stats.reactionSum / s.stats.decisions).toFixed(1) + 'd' : '—';
  const n = netPayable(s.gst.output, s.gst.itc), o = s.gst.output, i = s.gst.itc;
  $('h-gst').textContent = `${inr(n.total)} by day ${s.gst.nextDue}`;
  $('gst').innerHTML = `Output tax: CGST ${inr(o.cgst)} · SGST ${inr(o.sgst)} · IGST ${inr(o.igst)}<br>ITC: CGST ${inr(i.cgst)} · SGST ${inr(i.sgst)} · IGST ${inr(i.igst)}<br><b>Net GSTR-3B payable ${inr(n.total)}</b> (due day ${s.gst.nextDue})`;
  const miss = s.stats.miss;
  $('alert').hidden = !(s.cash < 20000 || miss);
  $('alert').textContent = s.cash < 20000 ? 'Cash critically low. Chase receivables or delay bills.' : `${miss} obligation(s) missed. Penalties ${inr(s.stats.penalties)}.`;
}

export function renderTrust(s, onChange) {
  const box = $('trust'); box.textContent = '';
  for (const [a, t] of Object.entries(s.trust)) {
    const row = document.createElement('div'); row.className = 'trow';
    const sel = document.createElement('select');
    for (const m of ['ask', 'auto']) sel.add(new Option(m === 'ask' ? 'Ask me' : 'Auto ≤ cap', m, false, t.mode === m));
    const cap = Object.assign(document.createElement('input'), { type: 'number', value: t.cap, step: 1000 });
    sel.onchange = () => { t.mode = sel.value; onChange?.(); }; cap.onchange = () => { t.cap = +cap.value; };
    row.append(Object.assign(document.createElement('span'), { textContent: a }), sel, cap);
    box.append(row);
  }
}

export function toast(title, body) {
  const t = document.createElement('div'); t.className = 'toast';
  t.append(Object.assign(document.createElement('b'), { textContent: title }), body);
  $('toasts').append(t); setTimeout(() => t.remove(), 4500);
}

export function renderProgress(p) {
  $('rk-name').textContent = p.rank; $('rk-xp').textContent = `${p.xp} XP`; $('rk-bar').style.width = p.pct + '%';
  $('rk-next').textContent = p.nextRank ? `${p.pct}% to ${p.nextRank}` : 'Top rank reached';
  $('m-count').textContent = `${p.missions.filter((m) => m.status === 'done').length}/${p.missions.length}`;
  const ul = $('missions'); ul.textContent = '';
  for (const m of p.missions) {
    const li = document.createElement('li'); li.className = m.status;
    const dot = Object.assign(document.createElement('div'), { className: 'dot', textContent: m.status === 'done' ? '✓' : m.status === 'failed' ? '×' : '' });
    const d = document.createElement('div');
    d.append(Object.assign(document.createElement('b'), { textContent: m.title }), Object.assign(document.createElement('span'), { textContent: m.desc }));
    li.append(dot, d); ul.append(li);
  }
  for (const m of p.fresh) toast('Mission complete', m.title);
}
