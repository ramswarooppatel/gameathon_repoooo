// Compliance and standards page, and the rewards store (who pays and how).
import { h, inr, today, toast } from './util.js';
import { icon } from './icons.js';
import { DUTIES, dutyStatus, registrations, CONTROLS, readiness, score } from './standards.js';
import { prevMonth } from '../workspace/calc.js';

const card = (title, ...kids) => h('section', { class: 'card' }, title && h('h3', {}, title), ...kids);
const seg = (items, cur, set) => h('div', { class: 'seg tabs-seg', role: 'tablist' }, ...items.map(([id, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(cur === id), 'aria-pressed': String(cur === id), onclick: () => set(id) }, l)));
const save = (name, text) => h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name }).click();
const CHIP = { built: ['Built in', 'good'], yours: ['Your action', 'warn'], planned: ['Planned', ''], na: ['Not applicable', 'info'] };

// ---------------------------------------------------------------- Compliance
let chain = null, cfilter = 'all';
export function standards(S, A) {
  if (chain === null) { chain = undefined; S.ledger.verify().then((n) => { chain = n; A.render(); }); }
  const t = today(), ym = t.slice(0, 7), checks = readiness(S, t, chain === undefined ? null : chain), pct = score(checks), ticked = (period, item) => S.ticks.some((x) => x.period === period && x.item === item), w = S.can('write');
  const due = [...DUTIES.map((d) => ({ ...d, period: prevMonth(ym, 1), date: d.due(prevMonth(ym, 1)) })), ...DUTIES.map((d) => ({ ...d, period: ym, date: d.due(ym) }))]
    .filter((d) => d.date && (d.period === ym || !ticked(d.period, 'duty:' + d.id)) && d.date >= prevMonth(ym, 1) + '-01').sort((a, b) => (a.date > b.date ? 1 : -1));
  const rows = CONTROLS.map((g) => ({ ...g, rows: g.rows.filter((r) => cfilter === 'all' || r[2] === cfilter) })).filter((g) => g.rows.length);
  const evidence = async () => {
    const n = await S.ledger.verify();
    save(`evidence-pack-${t}.json`, JSON.stringify({ generated: t, company: S.profile.name, gstin: S.profile.gstin, note: 'Self-assessment. Aligned with the listed standards; not a certification.', readiness: checks.map(({ label, ok }) => ({ label, ok })), audit_chain: { entries: S.ledger.entries.length, first_broken_entry: n || null, intact: !n }, members: S.members.map((m) => ({ name: m.display_name, role: m.role })), controls: CONTROLS }, null, 2));
  };
  return h('div', { class: 'stack' },
    h('p', { class: 'al low' }, h('b', {}, 'Aligned, not certified. '), 'ISO certificates are issued by accredited auditors after a formal audit. This page shows what the platform already does and what is left on your side, so an audit starts from evidence.'),
    h('div', { class: 'grid2' },
      card('Your readiness', h('div', { class: 'ready' }, h('div', { class: 'ring', style: `--p:${pct}`, role: 'img', 'aria-label': `${pct} percent ready` }, h('b', {}, pct + '%')),
        h('div', { class: 'grow' }, ...checks.map((c) => h('div', { class: 'chk-row' }, h('i', { class: c.ok ? 'ok' : 'no', 'aria-hidden': 'true' }, icon(c.ok ? 'check' : 'minus', { size: 14 })), h('span', {}, c.label, !c.ok && h('small', { class: 'mu block' }, c.fix)), !c.ok && h('button', { class: 'sm', onclick: () => A.go(c.go) }, 'Fix'))))),
        h('div', { class: 'acts wrap' }, h('button', { onclick: () => { chain = null; A.render(); } }, 'Re-check integrity'), h('button', { class: 'pri', onclick: evidence }, 'Download evidence pack'))),
      card('Set up once', h('p', { class: 'mu small' }, 'Tick what you already have. Banks, lenders and auditors ask for these.'),
        ...registrations.map(([id, label, why]) => h('label', { class: 'wf-check' + (ticked('once', 'reg:' + id) ? ' done' : '') }, h('input', { type: 'checkbox', checked: ticked('once', 'reg:' + id), disabled: !w, onchange: (e) => A.tick('once', 'reg:' + id, e.target.checked) }), h('span', { class: 'grow' }, h('b', {}, label), h('small', { class: 'mu block' }, why)))))),
    card('Due this month and last month', h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Duty', 'Applies to', 'Due', 'Status', 'Done'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...due.map((d) => { const done = ticked(d.period, 'duty:' + d.id), st = dutyStatus(d.date, done, t); return h('tr', {}, h('td', {}, h('b', {}, d.label), h('small', { class: 'mu block' }, d.note)), h('td', {}, d.who), h('td', {}, d.date),
        h('td', {}, h('span', { class: 'chip ' + { done: 'good', overdue: 'bad', soon: 'warn', later: '' }[st] }, { done: 'Done', overdue: 'Overdue', soon: 'Due soon', later: 'Upcoming' }[st])),
        h('td', {}, h('input', { type: 'checkbox', checked: done, disabled: !w, 'aria-label': `${d.label} done`, onchange: (e) => A.tick(d.period, 'duty:' + d.id, e.target.checked) }))); })))),
      h('p', { class: 'mu small' }, 'Dates are standard due dates. Extensions, state rules and your turnover can change them. Confirm with your CA.')),
    card('Standards and how we meet them', seg([['all', 'All'], ['built', 'Built in'], ['yours', 'Your action'], ['planned', 'Planned']], cfilter, (v) => { cfilter = v; A.render(); }),
      ...rows.map((g) => h('div', { class: 'std' }, h('h4', {}, g.std, h('small', { class: 'mu' }, ' · ' + g.area)),
        ...g.rows.map(([req, how, st]) => h('div', { class: 'std-row' }, h('div', { class: 'grow' }, h('b', {}, req), h('small', { class: 'mu block' }, how)), h('span', { class: 'chip ' + CHIP[st][1] }, CHIP[st][0])))))));
}

// ---------------------------------------------------------------- Rewards: progress, store, funding
let rtab = 'progress';
const monthKey = () => today().slice(0, 7);
const SUGGEST = [['Team coffee', 'A round of coffee for the team', 300, 300], ['Early finish Friday', 'Leave two hours early', 600, 0], ['Gift voucher ₹500', 'A voucher chosen by the member', 1200, 500], ['Learning budget ₹1,000', 'A course or book', 2400, 1000]];

export function rewardsPage(S, A, progress) {
  const pend = S.redemptions.filter((r) => r.status === 'pending').length;
  return h('div', { class: 'stack' }, seg([['progress', 'Progress'], ['store', 'Rewards store' + (S.can('admin') && pend ? ` (${pend})` : '')], ['funding', 'Who pays']], rtab, (v) => { rtab = v; A.render(); }),
    rtab === 'progress' ? progress(S, A) : rtab === 'store' ? store(S, A) : funding(S, A));
}

function poolUsed(S) { return S.redemptions.filter((r) => r.status !== 'rejected' && r.created_at.slice(0, 7) === monthKey()).reduce((a, r) => a + r.cost_inr, 0); }

function store(S, A) {
  const admin = S.can('admin'), pool = +S.profile.reward_pool_monthly || 0, used = poolUsed(S), left = Math.max(0, pool - used), mine = S.redemptions.filter((r) => r.user_id === S.repo.userId);
  const btn = (r) => {
    const why = !r.active ? 'Paused' : S.spendable < r.xp_cost ? `${r.xp_cost - S.spendable} XP to go` : used + r.cost_inr > pool ? 'Pool used up this month' : '';
    return h('button', { class: why ? '' : 'pri', disabled: !!why, onclick: () => A.redeem(r.id) }, why || 'Redeem');
  };
  const name = h('input', { placeholder: 'Reward name', maxLength: 80 }), desc = h('input', { placeholder: 'Short description' }), xp = h('input', { type: 'number', min: 1, placeholder: 'XP cost' }), cost = h('input', { type: 'number', min: 0, placeholder: 'Company cost ₹' });
  const poolIn = h('input', { type: 'number', min: 0, step: 500, value: pool, 'aria-label': 'Monthly reward pool in rupees' });
  const CH = { pending: ['Waiting for approval', 'warn'], approved: ['Approved', 'info'], fulfilled: ['Delivered', 'good'], rejected: ['Declined', 'bad'] };
  return h('div', { class: 'stack' },
    h('div', { class: 'grid2' },
      card('Your XP to spend', h('div', { class: 'big' }, `${S.spendable} XP`), h('small', { class: 'mu' }, `Level ${S.level.n} · ${S.level.name}. Spending XP never lowers your level.`)),
      card('Company reward pool this month', h('div', { class: 'big' }, pool ? `${inr(left)} left` : 'Not set up'), h('i', { class: 'bar' }, h('u', { style: `width:${pool ? Math.min(100, (used / pool) * 100) : 0}%` })),
        h('small', { class: 'mu' }, pool ? `${inr(used)} of ${inr(pool)} used. Resets each month.` : admin ? 'Set a monthly pool below to turn rewards on.' : 'Ask an admin to set a monthly pool.'))),
    card('Rewards', S.rewards.length ? h('div', { class: 'g-lessons' }, ...S.rewards.map((r) => h('div', { class: 'card lesson' + (r.active ? '' : ' is-done') }, icon('gift', { size: 20 }), h('b', {}, r.name), h('small', { class: 'mu' }, r.description || ' '),
        h('div', { class: 'row' }, h('span', { class: 'chip info' }, `${r.xp_cost} XP`), admin && h('span', { class: 'chip' }, `Company pays ${inr(r.cost_inr)}`)),
        h('div', { class: 'acts' }, btn(r), admin && h('button', { onclick: () => A.toggleReward(r.id) }, r.active ? 'Pause' : 'Resume'), admin && h('button', { 'aria-label': 'Delete ' + r.name, onclick: () => confirm(`Delete ${r.name}?`) && A.removeReward(r.id) }, icon('x', { size: 14 })))))) : h('p', { class: 'mu' }, admin ? 'No rewards yet. Add your own below or start from a suggestion.' : 'No rewards yet. An admin adds them.')),
    admin && card('Requests to decide', ...(S.redemptions.filter((r) => r.status === 'pending' || r.status === 'approved').map((r) => h('div', { class: 'wf-item' }, h('div', { class: 'grow' }, h('b', {}, `${r.member_name || 'Member'} · ${r.reward_name}`), h('small', { class: 'mu block' }, `${r.xp_cost} XP · company pays ${inr(r.cost_inr)} · ${r.created_at.slice(0, 10)}`), h('span', { class: 'chip ' + CH[r.status][1] }, CH[r.status][0])),
        h('div', { class: 'acts' }, r.status === 'pending' && h('button', { class: 'pri', onclick: () => A.decideRedemption(r.id, 'approved') }, 'Approve'), r.status === 'pending' && h('button', { onclick: () => { const n = prompt('Reason (shown to the member):', ''); if (n !== null) A.decideRedemption(r.id, 'rejected', n); } }, 'Decline'), r.status === 'approved' && h('button', { class: 'pri', onclick: () => A.decideRedemption(r.id, 'fulfilled') }, 'Mark delivered'))))
      .concat(S.redemptions.some((r) => r.status === 'pending' || r.status === 'approved') ? [] : [h('p', { class: 'mu' }, 'Nothing waiting.')]))),
    card('My requests', mine.length ? h('div', {}, ...mine.map((r) => h('div', { class: 'up' }, h('div', {}, h('b', {}, r.reward_name), h('small', { class: 'mu block' }, `${r.xp_cost} XP · ${r.created_at.slice(0, 10)}${r.note ? ' · ' + r.note : ''}`)), h('span', { class: 'chip ' + CH[r.status][1] }, CH[r.status][0])))) : h('p', { class: 'mu' }, 'You have not redeemed anything yet.')),
    admin && card('Set up rewards', h('div', { class: 'row' }, h('label', {}, 'Monthly pool ₹', poolIn), h('button', { class: 'pri', onclick: () => A.setPool(poolIn.value) }, 'Save pool')),
      h('p', { class: 'mu small' }, 'The pool is the most the company can pay in a month. Requests beyond it are blocked by the database.'),
      h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); if (!name.value.trim() || !(+xp.value > 0)) return toast('Name and XP cost needed', '', 'bad'); A.saveReward({ name: name.value.trim(), description: desc.value.trim() || null, xp_cost: Math.round(+xp.value), cost_inr: Math.max(0, +cost.value || 0) }); } }, name, desc, xp, cost, h('button', { type: 'submit' }, 'Add reward')),
      h('div', { class: 'acts wrap' }, h('small', { class: 'mu' }, 'Quick add:'), ...SUGGEST.filter(([n]) => !S.rewards.some((r) => r.name === n)).map(([n, d, x, c]) => h('button', { class: 'sm', onclick: () => A.saveReward({ name: n, description: d, xp_cost: x, cost_inr: c }) }, `${n} · ${x} XP`)))));
}

function funding(S, A) {
  const t = today(), from = new Date(Date.parse(t) - 90 * 86400000).toISOString().slice(0, 10);
  const onTime = S.allRows.filter((r) => r.kind === 'sale' && r.paid_date && r.paid_date >= from && (!r.due_date || r.paid_date <= r.due_date)).reduce((a, r) => a + r.total, 0), suggest = Math.round((onTime * 0.005) / 100) * 100;
  const col = (title, tag, kind, ...lines) => h('section', { class: 'card fund' }, h('span', { class: 'chip ' + kind }, tag), h('h3', {}, title), ...lines.map((l) => h('p', { class: 'mu' }, l)));
  return h('div', { class: 'stack' },
    h('div', { class: 'grid3' },
      col('Points and badges', 'Free', 'good', 'XP, levels, streaks, badges and the leaderboard cost nobody anything.', 'They have no cash value and are free in every plan.'),
      col('Company rewards', 'Your company pays', 'warn', 'An admin sets a monthly pool and the rewards. Members redeem XP, an admin approves, and the company delivers: a voucher, lunch, leave.', 'Mind Your Funds never holds or moves this money.'),
      col('Partner perks', 'Sponsor pays', '', 'Planned: discounts from partners such as accountants, banks and software. The sponsor pays; you pay nothing.', 'Every sponsored offer will be labelled as sponsored.')),
    card('How big should the pool be?',
      h('p', {}, 'Good habits save money: faster collections mean less borrowing, and on-time filing avoids late fees. A fair rule is to share a small part of that back.'),
      h('div', { class: 'step-row' }, h('div', {}, h('small', { class: 'mu' }, 'Collected on time, last 90 days'), h('b', { class: 'big' }, inr(onTime))), h('div', {}, h('small', { class: 'mu' }, 'Suggested monthly pool (0.5%)'), h('b', { class: 'big' }, inr(suggest))), h('div', {}, h('small', { class: 'mu' }, 'Current pool'), h('b', { class: 'big' }, inr(S.profile.reward_pool_monthly || 0)))),
      S.can('admin') ? h('button', { class: 'pri', disabled: !suggest, onclick: () => A.setPool(suggest) }, suggest ? `Use ${inr(suggest)} as the pool` : 'Collect some invoices on time first') : h('p', { class: 'mu small' }, 'Only an admin can set the pool.')),
    card('Safeguards', h('ul', { class: 'plain' },
      h('li', {}, 'The monthly pool is a hard cap, enforced by the database. The worst case is the pool, never more.'),
      h('li', {}, 'An admin approves every request before anything is delivered.'),
      h('li', {}, 'XP is held when you request a reward and returned if it is declined.'),
      h('li', {}, 'Every pool change, request and decision is written to the audit trail.'),
      h('li', {}, 'Rewards for staff can be taxable perquisites or gifts. Check the rules with your CA.'))));
}
