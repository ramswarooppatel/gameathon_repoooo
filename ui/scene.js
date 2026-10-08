// Operations floor: a skyline whose lights track business health; four specialist avatars pulse when they hold a decision.
const CREW = { collector: ['CO', '#7cc4ff', 90], treasurer: ['TR', '#f5d36b', 210], sentinel: ['SE', '#ff9b9b', 330], scout: ['SC', '#7ff0b0', 450] };
const SEED = [60, 95, 70, 120, 85, 110, 65, 100, 80, 125, 75, 90];

export function drawScene(ctx, s, cards, t) {
  const { width: W, height: H } = ctx.canvas, h = s.health / 100;
  const col = h > 0.6 ? '25,195,125' : h > 0.35 ? '245,185,66' : '239,91,91';
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1a14'); bg.addColorStop(1, '#07100c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  SEED.forEach((bh, i) => { // skyline
    const x = 14 + i * 42, y = 190 - bh * 1.1;
    ctx.fillStyle = '#10241b'; ctx.fillRect(x, y, 34, 190 - y);
    for (let r = 0; r < Math.floor(bh / 18); r++) for (let c = 0; c < 2; c++) {
      const lit = ((i * 7 + r * 3 + c) % 10) / 10 < h;
      ctx.fillStyle = lit ? `rgba(${col},${0.35 + 0.4 * Math.abs(Math.sin(t / 900 + i + r))})` : '#142a20';
      ctx.fillRect(x + 6 + c * 14, y + 8 + r * 16, 8, 8);
    }
  });
  ctx.fillStyle = '#0d1a14'; ctx.fillRect(0, 190, W, 90);
  ctx.strokeStyle = `rgba(${col},.5)`; ctx.beginPath(); ctx.moveTo(0, 190); ctx.lineTo(W, 190); ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = '600 13px system-ui';
  for (const [a, [ini, c, x]] of Object.entries(CREW)) {
    const hot = cards.some((k) => k.agent === a), r = 24 + (hot ? Math.sin(t / 180) * 3 : 0);
    if (hot) { ctx.strokeStyle = c; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, 232, r + 8, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#13261d'; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, 232, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c; ctx.fillText(ini, x, 237);
    ctx.fillStyle = '#8aa398'; ctx.font = '11px system-ui'; ctx.fillText(a, x, 272); ctx.font = '600 13px system-ui';
  }
  ctx.fillStyle = '#8aa398'; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(`DAY ${s.day} / 90`, 14, 18);
}
