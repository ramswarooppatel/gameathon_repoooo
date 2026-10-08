import { h, inr, today, toast } from './util.js';
import { QUESTS, BADGES, LEVELS } from './gamify.js';
import { toCsv, gstFor, enrich, prevMonth, daysBetween, guessSupply } from '../workspace/calc.js';
import { validGstin } from '../tax/gst.js';
import { GST_LATE_INTEREST_PA } from '../tax/config.js';
import { ask } from '../ai/groq.js';
import { scratch, confetti } from './fx.js';
import { parseBank, matchBank } from './bank.js';
import { appearanceCard } from './extras.js';
import { icon } from './icons.js';
import { invoiceSettingsCard } from './views4.js';

const KIND = { sale: 'Sale', purchase: 'Purchase', expense: 'Expense', salary: 'Salary' };
const card = (title, ...kids) => h('section', { class: 'card' }, h('h3', {}, title), ...kids);
const empty = (t) => h('p', { class: 'mu' }, t);
const download = (name, text, type = 'text/csv') => h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }).click();

function ring(score, label, suffix = '') {
  const c = score >= 70 ? '#19c37d' : score >= 45 ? '#f5b942' : '#ef5b5b', box = h('div', { class: 'ring' });
  box.innerHTML = `<svg viewBox="0 0 130 130"><circle cx="65" cy="65" r="54" fill="none" stroke="#17291f" stroke-width="12"/><circle class="arc" cx="65" cy="65" r="54" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(Math.min(100, score) * 3.393).toFixed(1)} 339.3" transform="rotate(-90 65 65)"/></svg>`;
  box.append(h('div', { class: 'rv' }, h('b', {}, score + suffix), h('span', {}, label)));
  return box;
}

// Sparkline SVG generator with delta indicator
function sparkline(vals, color = '#19c37d') {
  if (!vals || vals.length < 2) return h('span', { class: 'spark-empty' });
  const W = 70, H = 22, min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const wrap = h('span', { class: 'spark-wrap' });
  wrap.innerHTML = `<svg width="${W}" height="${H}" class="sparkline" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/></svg>`;
  return wrap;
}

function chart(monthly) {
  const max = Math.max(1, ...monthly.flatMap((m) => [m.income, m.spend])), W = 580, H = 180, bw = 24, g = W / monthly.length;
  const tip = h('div', { class: 'chart-tooltip', hidden: true });
  
  let s = `<svg viewBox="0 0 ${W} ${H + 30}" class="chart" role="img" aria-label="Income vs Spend 6-Month Chart"><title>Income vs Spend (Last 6 Months)</title><desc>Monthly breakdown of collections and expenditures</desc>`;
  
  // Background grid lines
  for (let l = 1; l <= 3; l++) {
    const y = Math.round((H / 4) * l);
    s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--line-subtle)" stroke-dasharray="3 3"/>`;
  }

  monthly.forEach((m, i) => {
    const x = i * g + g / 2, hi = Math.max(4, (m.income / max) * (H - 10)), hs = Math.max(4, (m.spend / max) * (H - 10));
    const net = m.income - m.spend;
    const monthLabel = m.m.slice(5) + '/' + m.m.slice(2, 4);
    s += `<g class="chart-col" data-idx="${i}" data-m="${monthLabel}" data-in="${m.income}" data-out="${m.spend}" data-net="${net}" tabindex="0" aria-label="${monthLabel}: Income ₹${Math.round(m.income)}, Spend ₹${Math.round(m.spend)}">
      <rect class="bar-income" x="${x - bw - 3}" y="${H - hi}" width="${bw}" height="${hi}" rx="5" fill="var(--acc)"/>
      <rect class="bar-spend" x="${x + 3}" y="${H - hs}" width="${bw}" height="${hs}" rx="5" fill="#5c756a"/>
      <text x="${x}" y="${H + 20}" text-anchor="middle" fill="var(--mu)" font-size="11" font-weight="500">${monthLabel}</text>
    </g>`;
  });
  s += '</svg>';

  const legend = h('div', { class: 'chart-legend' },
    h('span', { class: 'leg-item leg-in' }, h('i', {}), 'Income / Sales'),
    h('span', { class: 'leg-item leg-out' }, h('i', {}), 'Spend & Payroll'),
    h('span', { class: 'leg-net mu small' }, `6M Net: ${inr(monthly.reduce((a, c) => a + (c.income - c.spend), 0))}`)
  );

  const container = h('div', { class: 'chart-box' }, legend);
  container.innerHTML = legend.outerHTML + s;
  container.append(tip);

  // Interactive tooltip positioning on hover & focus
  const cols = container.querySelectorAll('.chart-col');
  cols.forEach((col) => {
    const showTip = () => {
      const label = col.dataset.m, inc = +col.dataset.in, out = +col.dataset.out, net = +col.dataset.net;
      tip.hidden = false;
      tip.innerHTML = `<b>${label} Breakdown</b><div class="tip-row in"><span>Income:</span> <b>${inr(inc)}</b></div><div class="tip-row out"><span>Spend:</span> <b>${inr(out)}</b></div><div class="tip-row net ${net >= 0 ? 'pos' : 'neg'}"><span>Net:</span> <b>${(net >= 0 ? '+' : '−') + inr(Math.abs(net))}</b></div>`;
      const rect = col.getBoundingClientRect(), boxRect = container.getBoundingClientRect();
      const left = rect.left - boxRect.left + rect.width / 2;
      tip.style.left = `${Math.max(60, Math.min(boxRect.width - 60, left))}px`;
      tip.style.top = `${Math.max(10, rect.top - boxRect.top - 70)}px`;
    };
    col.addEventListener('mouseenter', showTip);
    col.addEventListener('focus', showTip);
    col.addEventListener('mouseleave', () => { tip.hidden = true; });
    col.addEventListener('blur', () => { tip.hidden = true; });
  });

  return container;
}

export function reminderText(S, r) {
  return `Hi ${r.party}, a gentle reminder that invoice ${r.number || ''} for ${inr(r.total)} was due on ${r.due_date}. Please share the payment status or expected date. Thank you. ${S.profile.name ? '— ' + S.profile.name : ''}`.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- Dashboard
const num = (v, key, pre = '₹') => h('b', { 'data-count': Math.round(v), 'data-key': key, 'data-pre': pre }, (v < 0 ? '−' : '') + pre + Math.abs(Math.round(v)).toLocaleString('en-IN'));
const PRIZES = [10, 15, 20, 25, 30, 50];
const prizeFor = (day) => PRIZES[[...day].reduce((a, c) => a + c.charCodeAt(0), 0) % PRIZES.length];

function stories(S) {
  const s = S.sum, L = S.level, out = [], add = (tone, title, body, go) => out.push({ tone, title, body, go });
  if (s.overdueAmt > 0) add('bad', `${inr(s.overdueAmt)} is stuck`, `${s.overdueCount} customer invoice(s) are past due. One reminder today can free it up.`, 'transactions');
  const fil = S.filingsView.find((f) => !f.saved && daysBetween(today(), f.due_date) <= 7 && daysBetween(today(), f.due_date) >= 0);
  if (fil) add('warn', `${fil.type === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'} due ${fil.due_date}`, 'File on time to earn 40 XP and avoid interest.', 'compliance');
  if (s.gst.itcAtRisk > 0) add('warn', `${inr(s.gst.itcAtRisk)} credit at risk`, 'Fix supplier GSTINs on your bills to claim it.', 'transactions');
  const goal = +S.profile.monthly_goal;
  if (goal > 0) add('good', `${Math.min(100, Math.round((s.collectedMonth / goal) * 100))}% of monthly goal`, `${inr(Math.max(0, goal - s.collectedMonth))} left to collect this month.`, 'dashboard');
  else add('info', 'Set a monthly goal', 'Pick a collection target and watch the ring fill.', 'settings');
  if (L.next) add('good', `${L.toNext} XP to ${L.next}`, 'Log a transaction, pay on time or resolve an alert.', 'rewards');
  add('info', `${S.ctx.streak}-day streak`, S.ctx.has('checkin', today()) ? 'Checked in today. See you tomorrow!' : 'Check in today to keep it alive.', 'rewards');
  if (s.runwayMonths) add(s.runwayMonths < 1.5 ? 'bad' : 'good', `${s.runwayMonths} months of runway`, s.runwayMonths < 1.5 ? 'Cash is tight. Delay a bill or chase receivables.' : 'Comfortable buffer at your current spend.', 'insights');
  
  const track = h('div', { class: 'stories' }, ...out.map((o) => {
    const btn = h('button', { class: 'story ' + o.tone, onclick: () => (location.hash = o.go) },
      h('div', { class: 'story-progress' }, h('div', { class: 'story-progress-bar' })),
      h('b', {}, o.title),
      h('span', {}, o.body)
    );
    return btn;
  }));

  // Attach auto-advancing timer carousel controller with hover pause
  import('./fx.js').then((fx) => fx.autoAdvanceStories?.(track)).catch(() => {});
  return track;
}

function rewardCard(S, A) {
  const done = QUESTS.filter((q) => q.done(S.ctx)).length, day = today(), got = S.events.find((e) => e.kind === 'scratch' && e.day === day), prize = prizeFor(day);
  if (got) return card('Daily reward', h('div', { class: 'prize' }, h('b', {}, `+${got.xp} XP`), h('small', {}, 'Claimed today. A new card unlocks tomorrow.')));
  if (done < 3) return card('Daily reward', h('div', { class: 'prize lock' }, h('b', {}, 'Locked'), h('small', {}, `Complete ${3 - done} more quest(s) to unlock a scratch card.`)), h('i', { class: 'bar' }, h('u', { style: `width:${(done / 3) * 100}%` })));
  
  const cv = h('canvas', { width: 260, height: 90, class: 'foil' }), wrap = h('div', { class: 'scratch' }, h('div', { class: 'prize' }, h('b', {}, `+${prize} XP`), h('small', {}, 'Bonus reward')), cv);
  let claimed = false;
  const reveal = async () => {
    if (claimed) return;
    claimed = true;
    confetti();
    await A.award('scratch', day, prize, 'Daily reward revealed');
    setTimeout(A.render, 900);
  };
  
  scratch(cv, reveal);
  
  // Accessible fallback for keyboard/tap users
  const tapBtn = h('button', {
    class: 'scratch-fallback-btn',
    type: 'button',
    onclick: reveal
  }, 'Tap to reveal');

  return card('Daily reward ready', wrap, tapBtn, h('p', { class: 'small mu center' }, 'Scratch the card or tap reveal to claim your bonus XP.'));
}

function onboarding(S, A) {
  const steps = [
    ['Set up your business', 'Name and a valid GSTIN', !!S.profile.name && validGstin(S.profile.gstin), 'settings'],
    ['Record your first transaction', 'Invoice, bill or expense', S.entries.length > 0, 'transactions'],
    ['Set a monthly collection goal', 'Gives the goal ring a target', +S.profile.monthly_goal > 0, 'settings'],
    ['Mark a return as filed', 'GSTR-1 or GSTR-3B', S.filings.length > 0, 'compliance'],
  ];
  const n = steps.filter((x) => x[2]).length;
  if (n === steps.length) return null;
  return card(`Get started · ${n}/${steps.length}`, h('i', { class: 'bar' }, h('u', { style: `width:${(n / steps.length) * 100}%` })),
    ...steps.map(([t, d, done, go]) => h('div', { class: 'quest ' + (done ? 'done' : '') }, h('i', {}, done ? icon('check', { size: 14 }) : ''), h('div', {}, h('b', {}, t), h('small', {}, d)), !done && h('button', { onclick: () => A.go(go) }, 'Do it'))));
}


function dashboard(S, A) {
  const s = S.sum, goal = +S.profile.monthly_goal;
  
  // Sparkline data extraction from 6 months of trends
  const mIn = s.monthly.map(m => m.income);
  const mOut = s.monthly.map(m => m.spend);
  const mNet = s.monthly.map(m => m.income - m.spend);
  
  // Delta calculation compared to previous month
  const lastM = s.monthly[s.monthly.length - 1] || { income: 0, spend: 0 };
  const prevM = s.monthly[s.monthly.length - 2] || { income: 0, spend: 0 };
  const inDeltaPct = prevM.income > 0 ? Math.round(((lastM.income - prevM.income) / prevM.income) * 100) : null;
  
  const k = (l, v, sub, key, cls = '', sparkVals = null, delta = null) => h('div', { class: 'kpi ' + cls },
    h('div', { class: 'kpi-head' },
      h('span', {}, l),
      delta != null ? h('span', { class: 'delta-pill ' + (delta >= 0 ? 'pos' : 'neg') }, icon(delta >= 0 ? 'arrow-up' : 'arrow-down', { size: 12 }), `${delta >= 0 ? '+' : ''}${delta}%`) : null
    ),
    h('div', { class: 'kpi-body' },
      num(v, key),
      sparkVals ? sparkline(sparkVals, cls.includes('bad') ? 'var(--bad)' : 'var(--acc)') : null
    ),
    sub && h('small', {}, sub)
  );

  const alerts = S.alerts;
  const alertRow = (a) => h('div', { class: 'al ' + a.sev }, h('span', {}, a.text), h('div', { class: 'acts' },
    ...(a.type === 'overdue' && S.can('write') ? [h('button', { onclick: () => A.reminder(a.id) }, 'Send reminder'), h('button', { onclick: () => A.markPaid(a.id) }, 'Mark paid')] : []),
    ...(a.type === 'payable' && S.can('write') ? [h('button', { onclick: () => A.markPaid(a.id) }, 'Mark paid')] : []),
    ...(a.type === 'approval' ? [h('button', { onclick: () => A.go('approvals') }, 'Review')] : []),
    ...(a.type === 'filing' ? [h('button', { onclick: () => A.go('compliance') }, 'Open')] : []),
    ...(a.type === 'itc' ? [h('button', { onclick: () => A.go('transactions') }, 'Review bills')] : [])));
    
  const rawGstin = S.profile.gstin || '';
  const maskedGstin = rawGstin ? rawGstin.slice(0, 4) + ' •••• •••• ' + rawGstin.slice(-3) : 'Add GSTIN in Settings';
  
  // Click-to-copy GSTIN element with toast confirmation
  const gstinEl = h('button', {
    class: 'bc-gstin-btn',
    title: rawGstin ? 'Click to copy GSTIN' : 'Add GSTIN in Settings',
    onclick: async (e) => {
      e.stopPropagation();
      if (!rawGstin) return A.go('settings');
      try {
        await navigator.clipboard.writeText(rawGstin);
        toast('Copied', `GSTIN ${rawGstin} copied to clipboard`);
      } catch {
        toast('GSTIN', rawGstin);
      }
    }
  }, h('svg', { viewBox: '0 0 20 20', width: '12', height: '12', fill: 'currentColor', class: 'copy-icon' },
    h('path', { d: 'M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z' }),
    h('path', { d: 'M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z' })
  ), maskedGstin);

  // Business Card with 3D Tilt attachment
  const bizCard = h('section', { class: 'bizcard' },
    h('div', { class: 'bc-top' }, h('b', {}, S.profile.name || 'Your business'), h('span', {}, 'MIND YOUR FUNDS')),
    h('div', { class: 'bc-cash' }, h('small', {}, 'Cash in hand'), num(s.cash, 'cash')),
    h('div', { class: 'bc-bot' }, gstinEl, h('span', { class: 'bc-level' }, `Lv ${S.level.n} · ${S.level.name}`))
  );
  import('./fx.js').then((fx) => fx.tilt?.(bizCard)).catch(() => {});

  return h('div', { class: 'stack' },
    h('div', { class: 'grid3' },
      bizCard,
      h('section', { class: 'card center' }, h('h3', {}, 'Business health'), ring(S.entries.length ? s.health : 0, S.entries.length ? (s.health >= 70 ? 'Healthy' : s.health >= 45 ? 'Watch' : 'At risk') : 'No data'), h('p', { class: 'small mu' }, `Runway ${s.runwayMonths} mo · ${s.overdueCount} overdue`)),
      h('section', { class: 'card center' }, h('h3', {}, 'Monthly goal'), goal > 0 ? ring(Math.min(100, Math.round((s.collectedMonth / goal) * 100)), 'collected', '%') : h('div', { class: 'prize lock' }, h('b', {}, 'No goal set'), h('button', { onclick: () => A.go('settings') }, 'Set a goal')), goal > 0 && h('p', { class: 'small mu' }, `${inr(s.collectedMonth)} of ${inr(goal)} this month`))),
    onboarding(S, A),
    stories(S),
    h('div', { class: 'kpis four' },
      k('To collect', s.receivable, `${inr(s.overdueAmt)} overdue`, 'recv', '', mIn, inDeltaPct),
      k('To pay', s.payable, `${s.upcoming.filter((u) => u.dir === 'out').length} due in 14 days`, 'pay', '', mOut),
      k('GST this month', s.gst.net.total, 'net payable after ITC', 'gst', '', mNet),
      k('Input credit at risk', s.gst.itcAtRisk, 'fix supplier GSTINs', 'itc', s.gst.itcAtRisk ? 'bad' : '')
    ),
    h('div', { class: 'grid2' },
      card("Today's quests", ...QUESTS.map((q) => { const d = q.done(S.ctx); return h('div', { class: 'quest ' + (d ? 'done' : '') }, h('i', {}, d ? icon('check', { size: 14 }) : ''), h('div', {}, h('b', {}, q.title), h('small', {}, `${q.desc}${q.progress && !d ? ' · ' + q.progress(S.ctx) : ''}`)), h('em', {}, `+${q.xp} XP`)); })),
      rewardCard(S, A)),
    h('div', { class: 'grid2' },
      card(`Needs attention (${alerts.length})`, ...(alerts.length ? alerts.slice(0, 6).map(alertRow) : [empty(S.entries.length ? 'All clear. Nothing needs your attention.' : 'No data yet. Add a transaction or load sample data in Settings.')])),
      card('Next 14 days', ...(s.upcoming.length ? s.upcoming.map((u) => h('div', { class: 'up' }, h('span', { class: 'dot ' + u.dir }), h('div', {}, h('b', {}, u.party), h('small', {}, `${u.dir === 'in' ? 'Collect' : 'Pay'} by ${u.due_date}`)), h('em', {}, (u.dir === 'in' ? '+' : '−') + inr(u.total)))) : [empty('Nothing due in the next 14 days.')]))),
    card('Income vs spend (6 months)', chart(s.monthly), h('p', { class: 'small mu' }, 'Hover or tap bars for detailed breakdown. Green = Sales · Grey = Spend & Payroll.')));
}

// ---------------------------------------------------------------- Transactions
function entryDialog(S, A) {
  const f = h('form', { class: 'form', method: 'dialog' });
  const sel = (id, opts, v) => h('select', { id }, ...opts.map(([val, t]) => h('option', { value: val, selected: val === v }, t)));
  const inp = (id, type = 'text', extra = {}) => h('input', { id, type, ...extra });
  const L = (t, el, cls = '', errId = '') => h('label', { class: cls }, t, el, errId ? h('small', { id: errId, class: 'field-err' }) : null);

  const kind = sel('e-kind', Object.entries(KIND), 'sale');
  const gstin = inp('e-gstin', 'text', { maxLength: 15, placeholder: '22AAAAA0000A1Z5' });
  const supply = sel('e-supply', [['intra', 'Same state (CGST + SGST)'], ['inter', 'Other state (IGST)']], 'intra');
  const gstinStatus = h('div', { class: 'gstin-status-msg mu small' });

  const validateGstinField = () => {
    gstin.value = gstin.value.toUpperCase().trim();
    if (!gstin.value) {
      gstinStatus.textContent = '';
      gstinStatus.className = 'gstin-status-msg mu small';
      gstin.classList.remove('err', 'valid');
      return;
    }
    const ok = validGstin(gstin.value);
    if (ok) {
      gstinStatus.replaceChildren(icon('check', { size: 14 }), ' Valid GSTIN (checksum verified)');
      gstinStatus.className = 'gstin-status-msg good small';
      gstin.classList.remove('err');
      gstin.classList.add('valid');
      if (validGstin(S.profile.gstin || '')) supply.value = guessSupply(S.profile.gstin, gstin.value);
    } else {
      gstinStatus.replaceChildren(icon('x', { size: 14 }), ' Invalid GSTIN format or checksum. Input credit may be flagged.');
      gstinStatus.className = 'gstin-status-msg bad small';
      gstin.classList.remove('valid');
      gstin.classList.add('err');
    }
  };

  gstin.oninput = validateGstinField;

  const rate = sel('e-rate', [0, 5, 12, 18, 28, 40].map((r) => [r, r + '%']), 18);
  const [date, due, paid] = [inp('e-date', 'date', { value: today(), required: true }), inp('e-due', 'date'), inp('e-paid', 'date')];
  const [num, party, taxable, cat] = [
    inp('e-num', 'text', { placeholder: 'e.g. INV-2026-001' }),
    inp('e-party', 'text', { required: true, placeholder: 'Client or vendor name' }),
    inp('e-taxable', 'number', { min: 0, step: '0.01', required: true, placeholder: '0.00' }),
    inp('e-cat', 'text', { placeholder: 'Rent, Software, Travel, Supplies…' })
  ];

  // Date coherence validation
  const dateErr = h('small', { class: 'field-err' });
  const checkDates = () => {
    if (due.value && date.value && due.value < date.value) {
      dateErr.textContent = 'Due date cannot precede invoice date';
      due.classList.add('err');
    } else {
      dateErr.textContent = '';
      due.classList.remove('err');
    }
  };
  date.onchange = checkDates;
  due.onchange = checkDates;

  kind.onchange = () => {
    if (kind.value === 'salary') rate.value = 0;
    updateTaxPreview();
  };

  party.setAttribute('list', 'party-list');
  const dl = h('datalist', { id: 'party-list' }, ...S.parties.map((p) => h('option', { value: p.name })));
  party.onchange = () => {
    const p = S.parties.find((x) => x.name === party.value);
    if (p?.gstin && !gstin.value) {
      gstin.value = p.gstin;
      validateGstinField();
    }
  };

  // Sticky Live Tax Preview Card
  const prevTaxable = h('b', {}, '₹0');
  const prevCgst = h('span', {}, '₹0');
  const prevSgst = h('span', {}, '₹0');
  const prevIgst = h('span', {}, '₹0');
  const prevTotal = h('b', { class: 'tax-grand-total' }, '₹0');
  const cgstRow = h('div', { class: 'tax-preview-row' }, h('span', {}, 'CGST:'), prevCgst);
  const sgstRow = h('div', { class: 'tax-preview-row' }, h('span', {}, 'SGST:'), prevSgst);
  const igstRow = h('div', { class: 'tax-preview-row', style: 'display:none' }, h('span', {}, 'IGST:'), prevIgst);

  const updateTaxPreview = () => {
    const val = +taxable.value || 0;
    const r = +rate.value || 0;
    const isInter = supply.value === 'inter';
    const t = (val * r) / 100;
    prevTaxable.textContent = inr(val);
    if (isInter) {
      cgstRow.style.display = 'none';
      sgstRow.style.display = 'none';
      igstRow.style.display = 'flex';
      prevIgst.textContent = inr(t);
    } else {
      cgstRow.style.display = 'flex';
      sgstRow.style.display = 'flex';
      igstRow.style.display = 'none';
      prevCgst.textContent = inr(t / 2);
      prevSgst.textContent = inr(t / 2);
    }
    prevTotal.textContent = inr(val + t);
  };

  taxable.oninput = updateTaxPreview;
  rate.onchange = updateTaxPreview;
  supply.onchange = updateTaxPreview;

  const taxPreviewBox = h('div', { class: 'tax-preview-card' },
    h('h4', { class: 'tax-preview-title' }, icon('bolt', { size: 16 }), ' Live tax summary'),
    h('div', { class: 'tax-preview-row' }, h('span', {}, 'Taxable Amount:'), prevTaxable),
    cgstRow,
    sgstRow,
    igstRow,
    h('div', { class: 'tax-preview-divider' }),
    h('div', { class: 'tax-preview-row total' }, h('span', {}, 'Grand Total:'), prevTotal)
  );

  const formFields = h('div', { class: 'form-grid-fields' },
    L('Type', kind), L('Invoice / Ref No.', num),
    L('Party / Payee *', party, 'full'),
    L('Party GSTIN', gstin, 'full'),
    gstinStatus,
    L('Category (for expenses)', cat, 'full'),
    L('Date *', date),
    h('label', {}, 'Due Date', due, dateErr),
    L('Taxable Value ₹ *', taxable),
    L('GST Rate', rate),
    L('Supply Type', supply),
    L('Paid on Date', paid)
  );

  const dlg = h('dialog', { class: 'dlg wide entry-dialog-modal' },
    h('div', { class: 'dialog-head' },
      h('h3', {}, 'Add New Transaction'),
      h('button', { type: 'button', class: 'dialog-close-btn', onclick: () => dlg.close(), title: 'Close (Esc)', 'aria-label': 'Close' }, icon('x', { size: 16 }))
    ),
    f,
    dl
  );

  f.append(
    h('div', { class: 'dialog-content-split' },
      formFields,
      taxPreviewBox
    ),
    h('div', { class: 'full row dialog-footer' },
      h('button', { type: 'button', onclick: () => dlg.close() }, 'Cancel (Esc)'),
      h('button', { class: 'pri', type: 'submit' }, 'Save Transaction (Enter)')
    )
  );

  // Keyboard navigation & ergonomics
  dlg.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dlg.close();
    }
  };

  f.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!party.value.trim() || !+taxable.value) {
      return toast('Missing required fields', 'Please provide a party name and taxable value.', 'bad');
    }
    if (due.value && date.value && due.value < date.value) {
      return toast('Invalid dates', 'Due date cannot precede invoice date.', 'bad');
    }
    try {
      await A.addEntry({
        kind: kind.value,
        number: num.value.trim() || null,
        party: party.value.trim(),
        gstin: gstin.value.trim() || null,
        category: cat.value.trim() || null,
        date: date.value,
        due_date: due.value || null,
        taxable: +taxable.value,
        gst_rate: +rate.value,
        supply: supply.value,
        paid_date: paid.value || null
      });
      dlg.close();
      f.reset();
      date.value = today();
      updateTaxPreview();
    } catch (x) {
      toast('Could not save', x.message, 'bad');
    }
  };

  return dlg;
}

function importDialog(S, A) {
  const body = h('div'), dlg = h('dialog', { class: 'dlg wide' }, h('h3', {}, 'Import bank statement'), body);
  const file = h('input', { type: 'file', accept: '.csv,text/csv', onchange: async (e) => { const f = e.target.files[0]; if (f) show(await f.text()); e.target.value = ''; } });
  const show = (text) => {
    const rows = parseBank(text);
    body.textContent = '';
    if (!rows.length) return body.append(h('p', { class: 'al high' }, 'No transactions found. The CSV needs a Date column and Debit/Credit (or Amount) columns.'), h('button', { onclick: () => dlg.close() }, 'Close'));
    const pairs = matchBank(rows, S.sum.rows), checks = [];
    const tb = h('tbody', {}, ...pairs.map(({ row, entry }) => {
      const cb = h('input', { type: 'checkbox', checked: !!entry, disabled: !entry }); checks.push([cb, entry, row]);
      return h('tr', {}, h('td', {}, cb), h('td', {}, row.date), h('td', {}, row.desc), h('td', { class: 'n' }, (row.amount > 0 ? '+' : '−') + inr(Math.abs(row.amount))),
        h('td', {}, entry ? h('span', { class: 'tag paid' }, `${entry.party} ${entry.number || ''}`) : h('button', { onclick: async (ev) => { ev.target.disabled = true; await A.addEntry({ kind: row.amount > 0 ? 'sale' : 'expense', number: null, party: row.desc.slice(0, 40) || 'Bank entry', gstin: null, category: 'Bank import', date: row.date, due_date: row.date, taxable: Math.abs(row.amount), gst_rate: 0, supply: 'intra', paid_date: row.date }); ev.target.textContent = 'Added'; } }, 'Add as entry')));
    }));
    const matched = pairs.filter((p) => p.entry).length;
    body.append(h('p', { class: 'mu' }, `${rows.length} bank transactions · ${matched} matched to open invoices/bills by amount.`), h('div', { class: 'scroll tall' }, h('table', {}, h('thead', {}, h('tr', {}, ...['', 'Date', 'Narration', 'Amount', 'Match'].map((x) => h('th', {}, x)))), tb)),
      h('div', { class: 'row' }, h('button', { onclick: () => dlg.close() }, 'Cancel'), h('span', { class: 'sp' }), h('button', { class: 'pri', onclick: async () => { const sel = checks.filter(([c, e]) => c.checked && e).map(([, e, r]) => [e.id, r.date]); dlg.close(); if (sel.length) await A.reconcile(sel); } }, 'Reconcile selected')));
  };
  dlg.openPicker = () => { body.textContent = ''; body.append(h('p', { class: 'mu' }, 'Choose a CSV exported from your bank (Date, Narration, Debit, Credit). Nothing leaves your browser until you confirm.'), file); dlg.showModal(); };
  return dlg;
}

let txFilter = 'all', txQuery = '', txSortCol = 'date', txSortAsc = false;
let txVisibleCols = { ref: true, due: true, taxable: true, tax: true };

function transactions(S, A) {
  const dlg = entryDialog(S, A), imp = importDialog(S, A);
  const selectedIds = new Set();
  const body = h('tbody');
  const thead = h('thead');

  // Floating Bulk Action Bar
  const bulkBar = h('div', { class: 'bulk-action-bar', style: 'display:none' });
  const bulkCount = h('span', { class: 'bulk-count' }, '0 selected');
  const bulkPayBtn = h('button', {
    class: 'pri sm',
    onclick: async () => {
      if (!selectedIds.size) return;
      const ids = [...selectedIds];
      for (const id of ids) {
        await A.markPaid(id);
      }
      selectedIds.clear();
      toast('Marked as paid', `Updated ${ids.length} transaction(s)`, 'good');
      draw();
    }
  }, icon('check', { size: 14 }), ' Mark as paid');
  const bulkClearBtn = h('button', {
    class: 'sm',
    onclick: () => {
      selectedIds.clear();
      draw();
    }
  }, 'Deselect all');

  bulkBar.append(bulkCount, bulkPayBtn, bulkClearBtn);

  const updateBulkBar = () => {
    if (selectedIds.size > 0 && S.can('write')) {
      bulkBar.style.display = 'flex';
      bulkCount.textContent = `${selectedIds.size} selected`;
    } else {
      bulkBar.style.display = 'none';
    }
  };

  const drawHeader = () => {
    thead.textContent = '';
    const thSort = (col, label, isNum = false) => {
      const active = txSortCol === col;
      const sortIcon = active ? icon(txSortAsc ? 'arrow-up' : 'arrow-down', { size: 12 }) : icon('arrows-v', { size: 12 });
      const th = h('th', {
        class: `sortable-th ${isNum ? 'n' : ''} ${active ? 'active' : ''}`,
        tabindex: '0',
        role: 'button',
        'aria-label': `Sort by ${label}`,
        onclick: () => {
          if (txSortCol === col) txSortAsc = !txSortAsc;
          else { txSortCol = col; txSortAsc = (col === 'party' || col === 'kind'); }
          draw();
        },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); th.click(); } }
      }, h('div', { class: 'th-content' }, label, h('span', { class: 'sort-icon' }, sortIcon)));
      return th;
    };

    const selectAllCb = h('input', {
      type: 'checkbox',
      title: 'Select all',
      onchange: (e) => {
        const rows = getFilteredRows();
        if (e.target.checked) rows.forEach((r) => selectedIds.add(r.id));
        else selectedIds.clear();
        draw();
      }
    });

    const ths = [
      h('th', { class: 'cb-col' }, selectAllCb),
      thSort('kind', 'Type'),
      txVisibleCols.ref ? thSort('number', 'No.') : null,
      thSort('party', 'Party'),
      thSort('date', 'Date'),
      txVisibleCols.due ? thSort('due_date', 'Due') : null,
      txVisibleCols.taxable ? thSort('taxable', 'Taxable', true) : null,
      txVisibleCols.tax ? thSort('tax', 'GST', true) : null,
      thSort('total', 'Total', true),
      thSort('status', 'Status'),
      h('th', { class: 'acts-th' }, 'Actions')
    ].filter(Boolean);

    thead.append(h('tr', {}, ...ths));
  };

  const getFilteredRows = () => {
    return S.allRows.filter((r) => {
      const mKind = txFilter === 'all' || r.kind === txFilter;
      const mQuery = !txQuery || (r.party + (r.number || '') + (r.category || '')).toLowerCase().includes(txQuery);
      return mKind && mQuery;
    }).sort((a, b) => {
      let valA = a[txSortCol] ?? '';
      let valB = b[txSortCol] ?? '';
      if (txSortCol === 'total') { valA = +a.total; valB = +b.total; }
      if (txSortCol === 'taxable') { valA = +a.taxable; valB = +b.taxable; }
      if (txSortCol === 'tax') { valA = +a.tax.total; valB = +b.tax.total; }
      if (txSortCol === 'status') {
        valA = a.paid_date ? 'paid' : (a.due_date && a.due_date < today() ? 'overdue' : 'open');
        valB = b.paid_date ? 'paid' : (b.due_date && b.due_date < today() ? 'overdue' : 'open');
      }
      if (typeof valA === 'string') return txSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return txSortAsc ? valA - valB : valB - valA;
    });
  };

  const draw = () => {
    drawHeader();
    body.textContent = '';
    const rows = getFilteredRows();

    if (!rows.length) {
      const emptyState = h('tr', {},
        h('td', { colSpan: 11, class: 'empty-table-cell' },
          h('div', { class: 'empty-state-wrap' },
            h('svg', { viewBox: '0 0 24 24', width: '48', height: '48', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
              h('path', { d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
            ),
            h('h4', {}, txQuery ? 'No matching transactions found' : 'No transactions recorded yet'),
            h('p', { class: 'mu small' }, txQuery ? 'Try clearing your search query or switching filters.' : 'Record your first sale, purchase or expense invoice to start tracking.'),
            S.can('write') && h('button', { class: 'pri sm', onclick: () => dlg.showModal() }, '+ Add transaction')
          )
        )
      );
      body.append(emptyState);
      updateBulkBar();
      return;
    }

    for (const r of rows) {
      const over = !r.paid_date && r.due_date && r.due_date < today();
      const isSelected = selectedIds.has(r.id);

      const rowCb = h('input', {
        type: 'checkbox',
        checked: isSelected,
        onchange: (e) => {
          if (e.target.checked) selectedIds.add(r.id);
          else selectedIds.delete(r.id);
          updateBulkBar();
        }
      });

      // Quick action buttons revealed on hover/focus
      const quickActs = h('div', { class: 'quick-acts' },
        S.can('write') && !r.paid_date && (r.approval || 'approved') === 'approved' && h('button', {
          class: 'sm pri-subtle',
          title: 'Mark as Paid',
          onclick: () => A.markPaid(r.id)
        }, 'Mark Paid'),
        S.can('write') && over && r.kind === 'sale' && h('button', {
          class: 'sm',
          title: 'Send Payment Reminder',
          onclick: () => A.reminder(r.id)
        }, 'Remind'),
        r.kind === 'sale' && h('button', {
          class: 'sm',
          title: 'View & Print Tax Invoice',
          onclick: () => A.printInvoice(r.id)
        }, 'Invoice'),
        S.can('admin') && h('button', {
          class: 'sm del-btn',
          title: 'Delete Entry',
          onclick: () => confirm('Delete this transaction? This action is permanently recorded in the audit trail.') && A.remove(r.id)
        }, icon('x', { size: 14 }))
      );

      const cells = [
        h('td', { class: 'cb-col' }, rowCb),
        h('td', { class: 'tx-kind-cell' },
          h('span', { class: `kind-pill ${r.kind}` }, KIND[r.kind] || r.kind)
        ),
        txVisibleCols.ref ? h('td', { class: 'mono small' }, r.number || '—') : null,
        h('td', { class: 'party-cell' },
          h('b', {}, r.party),
          r.category ? h('small', { class: 'mu block' }, r.category) : null
        ),
        h('td', {}, r.date),
        txVisibleCols.due ? h('td', { class: over ? 'bad' : '' }, r.due_date || '—') : null,
        txVisibleCols.taxable ? h('td', { class: 'n' }, inr(r.taxable)) : null,
        txVisibleCols.tax ? h('td', { class: 'n mu small' }, inr(r.tax.total)) : null,
        h('td', { class: 'n font-bold' }, inr(r.total)),
        h('td', {},
          r.approval === 'pending'
            ? h('span', { class: 'tag' }, 'Pending approval')
            : r.approval === 'rejected'
            ? h('span', { class: 'tag over' }, 'Rejected')
            : h('span', { class: 'tag ' + (r.paid_date ? 'paid' : over ? 'over' : '') }, r.paid_date ? 'Paid' : over ? 'Overdue' : 'Open')
        ),
        h('td', { class: 'acts-cell' }, quickActs)
      ].filter(Boolean);

      const tr = h('tr', { class: `tx-row ${isSelected ? 'selected' : ''}` }, ...cells);
      body.append(tr);
    }

    updateBulkBar();
  };

  // Column visibility toggle menu
  const colMenu = h('div', { class: 'col-menu-dropdown', style: 'display:none' });
  const toggleColMenu = (e) => {
    e.stopPropagation();
    colMenu.style.display = colMenu.style.display === 'none' ? 'block' : 'none';
  };
  document.addEventListener('click', () => { colMenu.style.display = 'none'; });

  const makeColToggle = (key, label) => {
    const cb = h('input', {
      type: 'checkbox',
      checked: txVisibleCols[key],
      onchange: () => {
        txVisibleCols[key] = cb.checked;
        draw();
      }
    });
    return h('label', { class: 'col-toggle-item', onclick: (e) => e.stopPropagation() }, cb, label);
  };

  colMenu.append(
    makeColToggle('ref', 'Invoice / Ref No.'),
    makeColToggle('due', 'Due Date'),
    makeColToggle('taxable', 'Taxable Value'),
    makeColToggle('tax', 'GST Amount')
  );

  const colToggleBtn = h('div', { class: 'col-toggle-wrap' },
    h('button', { class: 'sm', onclick: toggleColMenu, title: 'Toggle visible columns' }, icon('sliders', { size: 14 }), ' Columns ', icon('chevron-down', { size: 12 })),
    colMenu
  );

  const filter = h('select', { onchange: (e) => { txFilter = e.target.value; draw(); } }, ...[['all', 'All Types'], ...Object.entries(KIND)].map(([v, t]) => h('option', { value: v, selected: v === txFilter }, t)));
  const search = h('input', { placeholder: 'Search party, invoice #, category…', value: txQuery, oninput: (e) => { txQuery = e.target.value.toLowerCase(); draw(); } });

  draw();

  return h('div', { class: 'stack' },
    card('Transactions',
      h('div', { class: 'row tx-toolbar' },
        filter,
        search,
        colToggleBtn,
        h('span', { class: 'sp' }),
        S.can('write') && h('button', { onclick: () => imp.openPicker() }, 'Import bank CSV'),
        h('button', { onclick: () => download(`transactions-${today()}.csv`, toCsv(S.allRows)) }, 'Export CSV'),
        S.can('write') && h('button', { class: 'pri', onclick: () => dlg.showModal() }, '+ Add transaction')
      ),
      bulkBar,
      h('div', { class: 'scroll sticky-table-wrap' },
        h('table', { class: 'tx-table' },
          thead,
          body
        )
      )
    ),
    dlg,
    imp
  );
}


// ---------------------------------------------------------------- Compliance
let gstMonth = null;
function compliance(S, A) {
  const cur = today().slice(0, 7), months = [0, 1, 2, 3].map((i) => prevMonth(cur, i));
  gstMonth ||= cur;
  const g = gstFor(S.sum.rows, gstMonth), hd = (o) => `CGST ${inr(o.cgst)} · SGST ${inr(o.sgst)} · IGST ${inr(o.igst)}`;
  const rows = S.filingsView.map((f) => {
    const net = f.type === 'GSTR3B' ? gstFor(S.sum.rows, f.period).net.total : 0, late = f.saved ? 0 : Math.max(0, daysBetween(f.due_date, today())), amt = h('input', { type: 'number', value: Math.round(net), min: 0, class: 'amt' });
    const interest = late > 0 && net > 0 ? Math.round(net * GST_LATE_INTEREST_PA * late / 365) : 0;
    return h('tr', {}, h('td', {}, f.type === 'GSTR1' ? 'GSTR-1 (sales)' : 'GSTR-3B (summary + tax)'), h('td', {}, f.period), h('td', {}, f.due_date),
      h('td', { class: 'n' }, f.type === 'GSTR3B' ? inr(net) : '—'),
      h('td', {}, h('span', { class: 'tag ' + (f.status === 'filed' ? 'paid' : f.status === 'late' || f.status === 'overdue' ? 'over' : '') }, f.status === 'filed' ? `Filed ${f.saved.filed_date}` : f.status === 'late' ? `Filed late ${f.saved.filed_date}` : f.status === 'overdue' ? `Overdue ${late}d${interest ? ` · est. interest ${inr(interest)}` : ''}` : 'Upcoming')),
      h('td', { class: 'acts' }, !f.saved && (f.type === 'GSTR3B' ? amt : null), !f.saved && h('button', { class: 'pri', onclick: () => A.file(f.type, f.period, f.due_date, +amt.value || 0) }, 'Mark filed')));
  });
  return h('div', { class: 'stack' },
    card('Filing calendar', h('p', { class: 'mu small' }, 'Mark a return as filed after you file it on the GST portal. Filing on or before the due date earns +40 XP and builds your compliance streak.'),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Return', 'Period', 'Due', 'Net tax', 'Status', ''].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)))),
    card('GST position', h('div', { class: 'row' }, h('span', { class: 'mu' }, 'Month'), h('select', { onchange: (e) => { gstMonth = e.target.value; A.render(); } }, ...months.map((m) => h('option', { value: m, selected: m === gstMonth }, m)))),
      h('div', { class: 'kpis' }, h('div', { class: 'kpi' }, h('span', {}, 'Output tax (sales)'), h('b', {}, inr(g.output.cgst + g.output.sgst + g.output.igst)), h('small', {}, hd(g.output))),
        h('div', { class: 'kpi' }, h('span', {}, 'Input credit (valid GSTIN)'), h('b', {}, inr(g.itc.cgst + g.itc.sgst + g.itc.igst)), h('small', {}, hd(g.itc))),
        h('div', { class: 'kpi' }, h('span', {}, 'Net payable'), h('b', {}, inr(g.net.total)), h('small', {}, hd(g.net.payable))),
        h('div', { class: 'kpi ' + (g.itcAtRisk ? 'bad' : '') }, h('span', {}, 'Credit at risk'), h('b', {}, inr(g.itcAtRisk)), h('small', {}, `${g.itcRiskRows.length} bill(s) without valid GSTIN`))),
      ...g.itcRiskRows.map((r) => h('div', { class: 'al med' }, `${r.party} · ${r.number || 'no number'} · ${inr(r.tax.total)} credit lost until the supplier GSTIN is corrected`)),
      h('p', { class: 'mu small' }, 'Planning estimates only. Verify with your Chartered Accountant before filing.')));
}

// ---------------------------------------------------------------- Insights
function insights(S, A) {
  const s = S.sum, out = h('div', { class: 'chat' }), q = h('input', { placeholder: 'Ask anything: "Can I afford a hire next month?"' });
  const facts = () => `Cash ₹${Math.round(s.cash)}, to collect ₹${Math.round(s.receivable)} (overdue ₹${Math.round(s.overdueAmt)}), to pay ₹${Math.round(s.payable)}, GST payable this month ₹${Math.round(s.gst.net.total)}, runway ${s.runwayMonths} months, health ${s.health}, ${S.alerts.length} open alerts. Due in 30 days: collect ₹${Math.round(s.in30)}, pay ₹${Math.round(s.out30)}.`;
  const say = async (text, fallback) => {
    out.append(h('div', { class: 'msg me' }, text)); const r = h('div', { class: 'msg ai' }, '…'); out.append(r);
    r.textContent = await ask([{ role: 'system', content: 'You are the Mind Your Funds CFO assistant for an Indian small business. Use only the facts given. Max 80 words, include ₹ numbers, no invented tax rules, end with the next action.' }, { role: 'user', content: `${facts()} Question: ${text.slice(0, 300)}` }], fallback);
    await A.audit('ai.ask', null, { q: text.slice(0, 80) }, `Asked the AI CFO: "${text.slice(0, 80)}" using aggregate figures only (no names).`);
    await A.award('ai_used', today(), 5, 'Asked the AI CFO');
  };
  const send = () => { if (q.value.trim()) { say(q.value, `With ${inr(s.cash)} cash and ${inr(s.out30)} due out in 30 days against ${inr(s.in30)} coming in, keep cash above one payroll plus the next GST payment before committing new spend.`); q.value = ''; } };
  q.onkeydown = (e) => e.key === 'Enter' && send();
  const slip = s.cash - s.out30, base = s.cash + s.in30 - s.out30;
  return h('div', { class: 'grid2' },
    card('AI CFO', h('div', { class: 'row' }, ...['Explain my month', 'What should I do this week?', 'Can I afford a new hire?'].map((p) => h('button', { onclick: () => say(p, `${inr(s.cash)} cash; ${inr(s.receivable)} to collect; ${inr(s.gst.net.total)} GST payable. ${S.alerts[0]?.text || 'No urgent items.'}`) }, p))),
      out, h('div', { class: 'row' }, q, h('button', { class: 'pri', onclick: send }, 'Ask')), h('p', { class: 'small mu' }, 'Only aggregate numbers are sent to the AI: never names or GSTINs.')),
    card('30-day stress test',
      h('div', { class: 'kpis one' }, h('div', { class: 'kpi' }, h('span', {}, 'Expected cash in 30 days'), h('b', {}, inr(base)), h('small', {}, `${inr(s.in30)} in · ${inr(s.out30)} out`)),
        h('div', { class: 'kpi ' + (slip < 0 ? 'bad' : '') }, h('span', {}, 'If every customer pays late'), h('b', {}, inr(slip)), h('small', {}, 'no collections in the window'))),
      h('p', { class: slip < 0 ? 'al high' : 'mu' }, slip < 0 ? 'You could run short if collections slip. Chase top invoices and negotiate supplier terms now.' : 'You can absorb a full month of late payments.')));
}

// ---------------------------------------------------------------- Rewards
function streakHistoryStrip(S) {
  const days = [];
  const t = today();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const checkedIn = S.ctx.has('checkin', dateStr);
    const isToday = dateStr === t;
    days.push({ dateStr, dayNum: d.getDate(), dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }), checkedIn, isToday });
  }

  const strip = h('div', { class: 'streak-strip' },
    ...days.map((item) => h('div', {
      class: `strip-day ${item.checkedIn ? 'checked' : 'missed'} ${item.isToday ? 'today' : ''}`,
      title: `${item.dateStr}: ${item.checkedIn ? 'Checked in (+10 XP)' : item.isToday ? 'Check in pending today' : 'No check in'}`
    },
      h('span', { class: 'strip-label' }, item.dayName),
      h('div', { class: 'strip-bubble' }, item.checkedIn ? icon('check', { size: 14 }) : item.isToday ? icon('dot', { size: 10 }) : icon('minus', { size: 12 })),
      h('small', { class: 'strip-num' }, String(item.dayNum))
    ))
  );

  return h('div', { class: 'streak-card-wrap' },
    h('div', { class: 'streak-header' },
      h('div', { class: 'streak-title-row' },
        h('span', { class: 'streak-flame-icon' }, icon('flame', { size: 26 })),
        h('b', {}, `${S.ctx.streak}-Day Active Streak`),
        h('span', { class: 'pill good' }, S.ctx.has('checkin', t) ? 'Active Today' : 'Pending Check-in')
      ),
      h('small', { class: 'mu' }, 'Check in daily to build habits, earn +10 XP, and protect your streak.')
    ),
    strip
  );
}

function badgeDetailModal(badge, earned, S) {
  const existing = document.getElementById('badge-modal');
  if (existing) existing.remove();

  const overlay = h('div', { id: 'badge-modal', class: 'overlay' });
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  const modal = h('div', { class: 'modal badge-modal-card' },
    h('div', { class: 'badge-modal-icon ' + (earned ? 'earned' : 'locked') }, icon(earned ? 'trophy' : 'lock', { size: 34 })),
    h('h3', { style: 'margin:0;font-size:var(--fs-lg)' }, badge.title),
    h('p', { class: 'mu', style: 'margin:4px 0' }, badge.desc),
    h('div', { class: 'badge-modal-meta' },
      h('span', { class: 'pill ' + (earned ? 'good' : 'warn') }, earned ? 'Unlocked' : 'Locked'),
      h('span', { class: 'mu small' }, `Reward: +25 XP`)
    ),
    h('div', { class: 'badge-criteria-box' },
      h('b', {}, 'Unlock Criteria'),
      h('p', { class: 'small mu' }, `Status: ${earned ? 'Completed and awarded.' : 'In progress — keep using the finance desk to unlock.'}`)
    ),
    h('button', { class: 'pri full', onclick: close }, 'Close')
  );

  overlay.append(modal);
  document.body.append(overlay);
}

function rewards(S, A) {
  const L = S.level, earned = new Set(S.badges.map((b) => b.code)), lb = h('div', { class: 'mu' }, 'Loading…');
  A.leaderboard().then((rows) => {
    lb.textContent = '';
    if (!rows.length) lb.append(empty(S.repo.mode === 'cloud' ? 'No one has joined yet. Opt in under Settings to appear here.' : 'Leaderboard needs a signed-in account.'));
    rows.forEach((r, i) => lb.append(h('div', { class: 'up' }, h('b', {}, `#${i + 1}`), h('div', {}, h('b', {}, r.nickname), h('small', {}, `Health ${r.health ?? '—'}`)), h('em', {}, `${r.xp} XP`))));
  });

  const badgeCards = BADGES.map((b) => {
    const isEarned = earned.has(b.code);
    return h('div', {
      class: 'badge ' + (isEarned ? 'on' : ''),
      tabindex: '0',
      role: 'button',
      'aria-label': `${b.title} badge: ${isEarned ? 'Unlocked' : 'Locked'}`,
      onclick: () => badgeDetailModal(b, isEarned, S),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); badgeDetailModal(b, isEarned, S); } }
    },
      h('div', { class: 'badge-head' },
        h('span', { class: 'badge-symbol' }, icon(isEarned ? 'trophy' : 'lock', { size: 18 })),
        h('b', {}, b.title)
      ),
      h('small', {}, b.desc)
    );
  });

  return h('div', { class: 'stack' },
    streakHistoryStrip(S),
    h('div', { class: 'grid2' },
      card('Your level',
        h('div', { class: 'lvl' },
          h('b', {}, `Level ${L.n} · ${L.name}`),
          h('span', {}, `${S.xp} XP`)
        ),
        h('i', { class: 'bar' }, h('u', { style: `width:${L.pct}%` })),
        h('p', { class: 'small mu' }, L.next ? `${L.toNext} XP to ${L.next}` : 'Top level reached'),
        h('div', { class: 'row' },
          h('button', {
            class: 'pri sm',
            onclick: () => import('./fx.js').then((fx) => fx.showLevelUpModal?.(L, S.xp, S.profile.name || 'Oxro Labs'))
          }, 'View Certificate / Share Card')
        ),
        h('p', { class: 'small mu', style: 'margin-top:10px' }, 'XP Rewards: Daily check-in +10 · Transaction +5 · Paid on time +15 · Return filed on time +40 · Alert resolved +10 · Badge +25')
      ),
      card('Leaderboard', lb)
    ),
    card(`Badges (${earned.size}/${BADGES.length}) · Tap for details`,
      h('div', { class: 'badges' }, ...badgeCards)
    ),
    card('Level ladder',
      h('div', { class: 'ladder' }, ...LEVELS.map(([x, n], i) => h('div', { class: i + 1 <= L.n ? 'on' : '' }, h('b', {}, n), h('small', {}, `${x} XP`))))
    )
  );
}

// ---------------------------------------------------------------- Audit
function audit(S, A) {
  const status = h('span', { class: 'pill' }, 'Not verified'), org = S.can('admin') && S.repo.mode === 'cloud', rows = org ? [...S.orgLog].sort((x, y) => (y.created_at || '').localeCompare(x.created_at || '')) : [...S.ledger.entries].reverse();
  const e2 = (e) => ({ n: e.n, day: e.day, agent: e.agent, action: e.decision?.action || '', why: e.why, hash: e.hash });
  return card(org ? 'Audit trail · whole company' : 'Audit trail · your activity', h('p', { class: 'mu small' }, 'Every change is recorded with who did it and why, and chained to the previous record with SHA-256. Editing history breaks the chain. Verification checks your own chain.'),
    h('div', { class: 'row' }, h('button', { class: 'pri', onclick: async () => { const bad = await S.ledger.verify(); status.textContent = bad ? `Tampered at #${bad}` : `Verified · ${S.ledger.entries.length} of your records`; status.classList.toggle('bad', !!bad); } }, 'Verify my chain'), status,
      h('span', { class: 'sp' }), h('button', { onclick: () => download(`audit-${today()}.json`, JSON.stringify(rows.map(e2), null, 2), 'application/json') }, 'Export')),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['#', 'Date', 'Who', 'Action', 'Why', 'Hash'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...(rows.length ? rows.map((r) => { const e = e2(r); return h('tr', {}, h('td', {}, String(e.n)), h('td', {}, e.day), h('td', {}, e.agent), h('td', {}, e.action), h('td', {}, e.why), h('td', { class: 'mono' }, (e.hash || '').slice(0, 10))); }) : [h('tr', {}, h('td', { colSpan: 6, class: 'mu' }, 'No activity yet.'))])))));
}

function recurringCard(S, A) {
  const kind = h('select', {}, ...[['expense', 'Expense'], ['salary', 'Salary'], ['purchase', 'Purchase'], ['sale', 'Sale']].map(([v, l]) => h('option', { value: v }, l)));
  const party = h('input', { placeholder: 'Rent, payroll, software…' }), amt = h('input', { type: 'number', min: 0, placeholder: 'Amount ₹', class: 'amt' }), day = h('input', { type: 'number', min: 1, max: 28, value: 1, class: 'amt' });
  const rate = h('select', {}, ...[0, 5, 12, 18, 28, 40].map((r) => h('option', { value: r }, r + '%')));
  return card('Recurring entries', h('p', { class: 'mu small' }, 'Created automatically each month on the chosen day (1–28).'),
    ...S.recurring.map((r) => h('div', { class: 'up' }, h('div', {}, h('b', {}, r.party), h('small', {}, `${KIND[r.kind]} · ${inr(r.taxable)} + ${r.gst_rate}% · day ${r.day_of_month}`)), h('button', { onclick: () => A.removeRecurring(r.id) }, 'Stop'))),
    h('div', { class: 'row' }, kind, party, amt, rate, day, h('button', { class: 'pri', onclick: () => { if (!party.value.trim() || !+amt.value) return toast('Add a name and amount', '', 'bad'); A.addRecurring({ kind: kind.value, party: party.value.trim(), taxable: +amt.value, gst_rate: +rate.value, day_of_month: Math.min(28, Math.max(1, +day.value || 1)), gstin: null, category: null }); } }, 'Add')));
}

// ---------------------------------------------------------------- Settings
function settings(S, A) {
  const p = S.profile, i = (id, v = '', t = 'text', ex = {}) => h('input', { id, type: t, value: v ?? '', ...ex });
  const [name, gstin, ob, nick, goal] = [i('s-name', p.name), i('s-gstin', p.gstin, 'text', { maxLength: 15 }), i('s-ob', p.opening_balance ?? 0, 'number', { step: '0.01' }), i('s-nick', p.nickname, 'text', { maxLength: 20 }), i('s-goal', p.monthly_goal ?? 0, 'number', { min: 0, step: '1000' })];
  const opt = h('input', { type: 'checkbox', checked: !!p.leaderboard_opt_in });
  gstin.oninput = () => { gstin.value = gstin.value.toUpperCase(); };
  if (!S.can('admin')) [name, gstin, ob, goal].forEach((x) => { x.disabled = true; });
  return h('div', { class: 'grid2' },
    card('Company profile', h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); if (gstin.value && !validGstin(gstin.value)) return toast('Invalid GSTIN', 'Check all 15 characters.', 'bad'); A.saveProfile({ name: name.value.trim(), gstin: gstin.value.trim() || null, opening_balance: +ob.value || 0, monthly_goal: +goal.value || 0, nickname: nick.value.trim() || null, leaderboard_opt_in: opt.checked && !!nick.value.trim() }); } },
      h('label', { class: 'full' }, 'Company name', name), h('label', { class: 'full' }, 'Company GSTIN', gstin), h('label', { class: 'full' }, 'Opening cash balance ₹', ob), h('label', { class: 'full' }, 'Monthly collection goal ₹', goal),
      h('label', { class: 'full' }, 'Leaderboard nickname', nick), h('label', { class: 'full chk' }, opt, ' Show me on the leaderboard (nickname, XP and health only)'), h('button', { class: 'pri full', type: 'submit' }, 'Save'))),
    h('div', { class: 'stack' },
      appearanceCard(h),
      card('Account & storage', h('p', {}, h('b', {}, S.repo.mode === 'cloud' ? 'Supabase cloud database' : 'Demo mode (this browser only)')), h('p', { class: 'mu' }, `${S.user.email} · role: ${S.repo.role}`),
        S.repo.mode === 'demo' && h('p', { class: 'al med' }, 'Demo mode does not sync. Sign in to store everything in your Supabase database.'), h('button', { onclick: A.signOut }, S.repo.mode === 'cloud' ? 'Sign out' : 'Exit demo')),
      invoiceSettingsCard(S, A),
      S.can('write') && recurringCard(S, A),
      card('Sample data', h('p', { class: 'mu' }, 'Load a realistic set of invoices, bills and expenses (with an overdue invoice and a bad GSTIN) to explore the app.'), S.can('write') ? h('button', { onclick: A.demo }, 'Load sample data') : h('p', { class: 'mu' }, 'Your role is read-only.')),
      card('Export and backup', h('div', { class: 'acts wrap' }, h('button', { onclick: () => download(`transactions-${today()}.csv`, toCsv(S.sum.rows)) }, 'Transactions (CSV)'), h('button', { onclick: A.backup }, 'Full backup (JSON)')), h('p', { class: 'mu small' }, 'The backup has invoices, transactions, directory, filings and the audit trail. Keep a copy at least monthly.'))));
}

export const VIEWS = { dashboard, transactions, compliance, insights, rewards, audit, settings };
