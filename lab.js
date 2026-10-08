import { bus } from './core/bus.js';
import { createGame, nextDay, decide } from './core/engine.js';
import { projectCash } from './core/forecast.js';
import { createLedger } from './ledger/blackbox.js';
import { receipt } from './ledger/why.js';
import { explain, cfo } from './ai/groq.js';
import * as db from './db/supabase.js';
import { drawScene } from './ui/scene.js';
import { renderHud, renderTrust, renderProgress } from './ui/hud.js';
import { progress } from './core/progress.js';
import { renderCards } from './ui/cards.js';
import { mulberry32 } from './core/rng.js';
import { snapshot, impact, impactWithoutSnapshot, injectStyles } from './ui/coach.js';
import { icon } from './app/icons.js';

const $ = (id) => document.getElementById(id);
let g, gh, ledger, last, timer = null, history = [];      // history: deep snapshots of both games, one per day advance (memory only, never saved)

async function start() {
  clearInterval(timer); timer = null; $('auto').textContent = 'Auto-play'; $('end').hidden = true; $('start').hidden = true;
  const seed = +$('seed').value || 42;
  g = createGame(seed); gh = createGame(seed, { crew: false }); impactBox.hidden = true; history = [];
  ledger = createLedger('fincrew-ledger'); ledger.clear();
  await db.startRun(seed, $('nick').value || 'Captain');
  $('log').textContent = '';
  renderTrust(g.s); render();
}

// Bus consumers: UI + ledger only listen; the engine owns state.
bus.on('card:decided', async ({ card, option, by, reactionDays, day }) => {
  let why = receipt(card, option, by, reactionDays);
  if ($('ai').checked) why = await explain(why, why);
  const e = await ledger.append({ day, agent: card.agent, cardId: card.id, decision: { option: option.label, by, costInr: option.costInr }, why });
  db.pushLedger(e);
  bus.emit('log:appended', e);
});
bus.on('log:appended', (e) => {
  const li = document.createElement('li');
  li.append(Object.assign(document.createElement('b'), { textContent: `#${e.n} d${e.day} ${e.agent} ` }), `${e.decision.option} (${e.decision.by}) · ${e.hash.slice(0, 8)}`);
  li.title = e.why; $('log').prepend(li);
});
bus.on('game:over', finish);

// Decision impact: a short, factual read-out of what the engine state did, then the matching existing lesson.
const impactBox = Object.assign(document.createElement('div'), { id: 'impact' }); impactBox.hidden = true;
$('cards').before(impactBox);
function showImpact(c, option, res) {
  impactBox.textContent = ''; impactBox.hidden = false; impactBox.className = 'impact' + (res.good ? '' : ' warn');
  const li = (t) => { const x = document.createElement('li'); x.append(icon(res.good ? 'check' : 'minus', { size: 14 }), t); return x; };
  const ul = document.createElement('ul'); res.lines.forEach((t) => ul.append(li(t)));
  const head = document.createElement('h5'); head.textContent = 'Decision impact';
  const close = Object.assign(document.createElement('button'), { className: 'sm', textContent: 'Dismiss', onclick: () => { impactBox.hidden = true; } });
  impactBox.append(head, ul);
  if (res.learned) { const p = document.createElement('p'); p.className = 'learned'; const b = document.createElement('b'); b.textContent = 'What you learned'; p.append(b, res.learned); impactBox.append(p); }
  const more = document.createElement('div'); more.className = 'more';
  if (res.lesson) {
    const info = document.createElement('div'), l = res.lesson; info.append(Object.assign(document.createElement('b'), { textContent: l.title }), document.createElement('br'), Object.assign(document.createElement('small'), { textContent: `${l.mins} min · ${l.quiz.length} questions · the same lesson as in Learn` }));
    // The lesson runs inside the main app (Learn page). We remember which one so Learn can highlight it.
    const open = Object.assign(document.createElement('a'), { className: 'btn', href: 'index.html#learn', textContent: 'Open lesson', onclick: () => { try { localStorage.setItem('myf-suggest-lesson', l.id); } catch {} } });
    more.append(info, open, close);
  } else more.append(close);
  impactBox.append(more);
}

function decideAndEmit(id, idx, by = 'owner') {
  const card = g.cards.find((c) => c.id === id), before = card && snapshot(g, card);
  const d = decide(g, id, idx, by);
  if (d) { bus.emit('card:decided', d); showImpact(d.card, d.option, impact(g, d.card, d.option, before)); }
  render();
}

// ---- rewind: one step back, by restoring deep snapshots of BOTH games (the engine is never run backwards) ----
const snap = (game) => { const { rng, ...rest } = game; return { data: structuredClone(rest), rng: rng.state() }; };       // rng is a closure: copy its position, not the function
const restore = (sn) => { const game = { ...structuredClone(sn.data), rng: mulberry32(0) }; game.rng.setState(sn.rng); return game; };
const prev = Object.assign(document.createElement('button'), { id: 'prev', title: 'Undo the last day advance (decisions made after it are undone too)' });
prev.append(icon('arrow-right', { size: 14 }), ' Previous Day'); prev.firstChild.style.cssText = 'display:inline-block;transform:scaleX(-1);vertical-align:-2px;margin-right:4px';
$('next').before(prev);
function rewind() {
  const h = history.pop(); if (!h) return;
  clearInterval(timer); timer = null; $('auto').textContent = 'Auto-play';
  const trust = g.s.trust;                                          // autonomy settings are controls, not simulation: keep what the Captain has set now
  g = restore(h.game); gh = restore(h.ghost); g.s.trust = trust;
  impactBox.hidden = true; render();
}
prev.onclick = rewind;

function step() {
  if (g.s.over) return;
  history.push({ game: snap(g), ghost: snap(gh) });
  const r = nextDay(g); nextDay(gh);
  if (r.cards.length) impactBox.hidden = true;                      // a new decision is open: clear the previous read-out so it cannot be mistaken for this one
  r.decided.forEach((d) => { bus.emit('card:decided', d); if (d.by !== 'owner' && !g.cards.length) showImpact(d.card, d.option, impactWithoutSnapshot(d.card, d.option, d.by)); });   // timeout/auto read-out only while nothing else is open
  render();
  if (g.s.over) bus.emit('game:over', g.s);
  else if (timer && g.cards.some((c) => c.urgent)) { clearInterval(timer); timer = null; $('auto').textContent = 'Auto-play'; } // pause on urgent
}

function render() {
  prev.disabled = !history.length;
  renderHud(g.s, gh.s);
  last = progress(g, gh); renderProgress(last);
  renderCards($('cards'), g.cards, g.s.day, (id, i) => decideAndEmit(id, i));
}

async function finish(s) {
  const gs = gh.s, st = s.stats;
  const stars = !s.won ? 0 : s.health >= gs.health * 1.4 ? 3 : s.health >= 80 ? 2 : 1;
  const react = st.decisions ? st.reactionSum / st.decisions : null;
  $('end-t').textContent = s.won ? 'Quarter complete: business survived' : 'Business ran out of cash';
  $('end-s').textContent = `${stars ? stars + (stars === 1 ? ' star' : ' stars') : 'No stars'} · rank ${last.rank} (${last.xp} XP)`;
  document.getElementById('compare')?.remove();
  const gap = s.health - gs.health, inr0 = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const side = (cls, tag, m, health) => { const d = document.createElement('div'); d.className = 'side ' + cls; d.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: tag }), Object.assign(document.createElement('b'), { className: 'big', textContent: `Health ${health}` }),
    ...[`Cash ${inr0(m.cash)}`, `Lowest cash ${inr0(m.stats.minCash)}`, `Missed obligations ${m.stats.miss}`, `Penalties ${inr0(m.stats.penalties)}`, `Fraud blocked ${inr0(m.stats.fraudBlocked)} · lost ${inr0(m.stats.fraudLost)}`].map((t) => Object.assign(document.createElement('small'), { textContent: t }))); return d; };
  const cmp = document.createElement('div'); cmp.id = 'compare'; cmp.className = 'compare';
  const vs = document.createElement('div'); vs.className = 'vs'; vs.append(side('you', 'Your business', s, s.health), side('', 'Unassisted twin', gs, gs.health));
  cmp.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: 'Same business · same events · different decisions' }), vs,
    Object.assign(document.createElement('p'), { className: 'verdict', textContent: gap > 0 ? `FinCrew helped you finish ${gap} health point${gap === 1 ? '' : 's'} ahead of the twin that had no crew.` : gap === 0 ? 'The twin matched your result this run. Review your decisions in the audit ledger to see where you can do better.' : `The unassisted twin finished ${-gap} point${gap === -1 ? '' : 's'} ahead this time. Open the audit ledger to see which decisions cost you.` }));
  $('end-s').after(cmp);
  $('end-b').textContent = ''; last.missions.filter((m) => m.status === 'done').forEach((m) => $('end-b').append(Object.assign(document.createElement('span'), { textContent: m.title })));
  $('end').hidden = false;
  await db.finishRun({ status: s.won ? 'won' : 'lost', final_health: s.health, ghost_health: gs.health, final_cash: s.cash, ghost_cash: gs.cash, stars, reaction_avg: react, fraud_blocked: st.fraudBlocked, fraud_lost: st.fraudLost });
  $('lb').textContent = '';
  for (const r of await db.leaderboard()) $('lb').append(Object.assign(document.createElement('li'), { textContent: `${r.nickname} — ${r.stars} stars health ${r.final_health}` }));
}

$('next').onclick = step;
$('restart').onclick = $('end-new').onclick = start;
$('auto').onclick = () => {
  if (timer) { clearInterval(timer); timer = null; $('auto').textContent = 'Auto-play'; return; }
  timer = setInterval(step, 600); $('auto').textContent = 'Pause';
};
$('verify').onclick = async () => {
  const bad = await ledger.verify();
  $('chain').textContent = bad ? `Tampered at #${bad}` : 'Verified'; $('chain').classList.toggle('bad', !!bad);
};
$('tamper').onclick = async () => { if (ledger.entries[0]) { ledger.entries[0].why += ' (edited)'; await $('verify').onclick(); } };
$('export').onclick = () => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ledger.export()], { type: 'application/json' })), download: 'ledger.json' });
  a.click();
};
$('ask').onclick = async () => { $('a').textContent = '…'; $('a').textContent = await cfo($('q').value, g.s, projectCash(g.s, g.s.day + 14)); };

function render0() { g = createGame(42); gh = createGame(42, { crew: false }); ledger = createLedger('fincrew-ledger'); renderTrust(g.s); render(); }
(function loop(t) { if (g) drawScene($('scene').getContext('2d'), g.s, g.cards, t); requestAnimationFrame(loop); })(0);
injectStyles();
$('begin').onclick = start;
await db.init();
render0();
