import { createGame, nextDay, decide } from '../core/engine.js';
function run(crew){ const g=createGame(42,{crew}); const out=[]; while(!g.s.over){ nextDay(g); if(crew) for(const c of [...g.cards]) decide(g,c.id,0); if(g.s.day%10===0||g.s.over) out.push([g.s.day,g.s.health,Math.round(g.s.cash)]); } return {out, fin:g.s}; }
const a=run(true), b=run(false);
console.log(JSON.stringify({crew:a.out,ghost:b.out,crewFin:{health:a.fin.health,cash:Math.round(a.fin.cash),won:a.fin.won,fraudBlocked:a.fin.stats.fraudBlocked,fraudLost:a.fin.stats.fraudLost,decisions:a.fin.stats.decisions},ghostFin:{health:b.fin.health,cash:Math.round(b.fin.cash),won:b.fin.won,fraudLost:b.fin.stats.fraudLost,day:b.fin.day}}));
