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

const $ = (id) => document.getElementById(id);
let g, gh, ledger, last, timer = null;

async function start() {
  clearInterval(timer); timer = null; $('auto').textContent = 'Auto-play'; $('end').hidden = true; $('start').hidden = true;
  const seed = +$('seed').value || 42;
  g = createGame(seed); gh = createGame(seed, { crew: false });
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

function decideAndEmit(id, idx, by = 'owner') {
  const d = decide(g, id, idx, by);
  if (d) bus.emit('card:decided', d);
  render();
}

function step() {
  if (g.s.over) return;
  const r = nextDay(g); nextDay(gh);
  r.decided.forEach((d) => bus.emit('card:decided', d));
  render();
  if (g.s.over) bus.emit('game:over', g.s);
  else if (timer && g.cards.some((c) => c.urgent)) { clearInterval(timer); timer = null; $('auto').textContent = 'Auto-play'; } // pause on urgent
}

function render() {
  renderHud(g.s, gh.s);
  last = progress(g, gh); renderProgress(last);
  renderCards($('cards'), g.cards, g.s.day, (id, i) => decideAndEmit(id, i));
}

async function finish(s) {
  const gs = gh.s, st = s.stats;
  const stars = !s.won ? 0 : s.health >= gs.health * 1.4 ? 3 : s.health >= 80 ? 2 : 1;
  const react = st.decisions ? st.reactionSum / st.decisions : null;
  $('end-t').textContent = s.won ? 'Quarter complete: business survived' : 'Business ran out of cash';
  $('end-s').textContent = `Health ${s.health} vs unassisted ${gs.health} · ${'★'.repeat(stars) || 'no stars'} · rank ${last.rank} (${last.xp} XP) · fraud blocked ₹${Math.round(st.fraudBlocked)} (ghost lost ₹${Math.round(gs.stats.fraudLost)})`;
  $('end-b').textContent = ''; last.missions.filter((m) => m.status === 'done').forEach((m) => $('end-b').append(Object.assign(document.createElement('span'), { textContent: m.title })));
  $('end').hidden = false;
  await db.finishRun({ status: s.won ? 'won' : 'lost', final_health: s.health, ghost_health: gs.health, final_cash: s.cash, ghost_cash: gs.cash, stars, reaction_avg: react, fraud_blocked: st.fraudBlocked, fraud_lost: st.fraudLost });
  $('lb').textContent = '';
  for (const r of await db.leaderboard()) $('lb').append(Object.assign(document.createElement('li'), { textContent: `${r.nickname} — ${'★'.repeat(r.stars)} health ${r.final_health}` }));
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
$('begin').onclick = start;
await db.init();
render0();
