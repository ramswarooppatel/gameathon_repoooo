// Delight layer: confetti, count-up numbers, scratch card. No dependencies.
export function confetti(n = 110) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = Object.assign(document.createElement('canvas'), { width: innerWidth, height: innerHeight });
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50';
  document.body.append(c);
  const ctx = c.getContext('2d'), cols = ['#19c37d', '#6ee7a8', '#f5b942', '#7cc4ff', '#ff9b9b'];
  const p = Array.from({ length: n }, () => ({ x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 12 - 4, s: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6 }));
  let t = 0;
  (function f() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const q of p) { q.vy += 0.35; q.x += q.vx; q.y += q.vy; q.r += 0.2; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * 0.6); ctx.restore(); }
    if (++t < 120) requestAnimationFrame(f); else c.remove();
  })();
}

// Floating XP Pop effect near click/target
export function spawnXpPop(xp, x, y) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pop = document.createElement('div');
  pop.className = 'xp-floating-pop';
  pop.textContent = `+${xp} XP`;
  pop.style.left = `${Math.max(10, Math.min(innerWidth - 70, (x ?? innerWidth / 2) - 30))}px`;
  pop.style.top = `${Math.max(10, (y ?? innerHeight / 2) - 20)}px`;
  document.body.append(pop);
  setTimeout(() => pop.remove(), 1200);
}

// Fullscreen Level Up Celebratory Modal with Dynamic Canvas Share Card
export function showLevelUpModal(level, xp, profileName = 'Oxro Labs') {
  const existing = document.getElementById('lvl-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lvl-modal';
  overlay.className = 'overlay lvl-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal lvl-modal-card';

  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 220;
  canvas.className = 'lvl-share-canvas';

  // Render dynamic share card onto canvas
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 440, 220);
  g.addColorStop(0, '#0a2218');
  g.addColorStop(1, '#05120d');
  ctx.fillStyle = g;
  ctx.roundRect ? ctx.roundRect(0, 0, 440, 220, 16) : ctx.rect(0, 0, 440, 220);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#19c37d';
  ctx.stroke();

  // Branding & Tier
  ctx.fillStyle = '#6ee7a8';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText('OXRO LABS · FINANCE DESK', 28, 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText(`Level ${level.n} · ${level.name}`, 28, 78);

  ctx.fillStyle = '#8aa398';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`Achieved with ${xp.toLocaleString('en-IN')} Lifetime XP`, 28, 110);
  ctx.fillText(`Organization: ${profileName}`, 28, 136);

  // Status Chip on canvas
  ctx.fillStyle = 'rgba(25, 195, 125, 0.2)';
  ctx.fillRect(28, 160, 130, 28);
  ctx.fillStyle = '#19c37d';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText('FINANCE CERTIFIED', 38, 178);

  const dlBtn = document.createElement('button');
  dlBtn.className = 'pri';
  dlBtn.textContent = 'Download Share Card';
  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.download = `oxro-level-${level.n}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Continue to Desk';
  closeBtn.onclick = () => overlay.remove();

  modal.append(
    Object.assign(document.createElement('h2'), { textContent: 'Level Up Complete!' }),
    Object.assign(document.createElement('p'), { className: 'mu', textContent: `Congratulations! You unlocked Level ${level.n}: ${level.name}.` }),
    canvas,
    Object.assign(document.createElement('div'), { className: 'row' }, dlBtn, closeBtn)
  );

  overlay.append(modal);
  document.body.append(overlay);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    confetti(120);
  }
}


// Animate [data-count] numbers from their previous value (remembered per data-key) to the new one.
const last = new Map();
export function countUp(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, key = el.dataset.key, from = last.get(key) ?? 0, pre = el.dataset.pre || '';
    last.set(key, to);
    if (from === to) return;
    const t0 = performance.now();
    (function f(t) {
      const k = Math.min(1, (t - t0) / 800), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = (v < 0 ? '−' : '') + pre + Math.abs(v).toLocaleString('en-IN');
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  });
}

// Scratch-to-reveal: grey foil canvas over `prize` content; calls onReveal once ~45% is cleared.
export function scratch(canvas, onReveal) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3a4a42'); g.addColorStop(1, '#6b7d73');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#cfe0d6'; ctx.font = '600 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Scratch here', W / 2, H / 2 + 5);
  let down = false, done = false;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  const wipe = (e) => {
    if (!down || done) return;
    const [x, y] = at(e); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill();
    const d = ctx.getImageData(0, 0, W, H).data; let clear = 0;
    for (let i = 3; i < d.length; i += 64) if (d[i] === 0) clear++;
    if (clear / (d.length / 64) > 0.45) { done = true; canvas.style.opacity = 0; onReveal(); }
  };
  canvas.onpointerdown = (e) => { down = true; canvas.setPointerCapture(e.pointerId); wipe(e); };
  canvas.onpointermove = wipe; canvas.onpointerup = () => { down = false; };
}

// 3D Tilt effect for Hero Business Card (respects prefers-reduced-motion)
export function tilt(cardEl) {
  if (!cardEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let bounds;
  const onMove = (e) => {
    bounds ||= cardEl.getBoundingClientRect();
    const mouseX = e.clientX - bounds.left;
    const mouseY = e.clientY - bounds.top;
    const xPct = (mouseX / bounds.width - 0.5) * 2; // -1 to 1
    const yPct = (mouseY / bounds.height - 0.5) * 2; // -1 to 1

    const rotateX = -yPct * 12; // degrees
    const rotateY = xPct * 14;  // degrees

    cardEl.style.transform = `perspective(600px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
  };

  const onEnter = () => {
    bounds = cardEl.getBoundingClientRect();
    cardEl.style.transition = 'transform 0.1s ease-out';
  };

  const onLeave = () => {
    cardEl.style.transition = 'transform 0.4s ease-out';
    cardEl.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0)';
  };

  cardEl.addEventListener('mousemove', onMove);
  cardEl.addEventListener('mouseenter', onEnter);
  cardEl.addEventListener('mouseleave', onLeave);
}

// Stories Auto-Advance Carousel with Progress Fill and Pause-on-Hover
export function autoAdvanceStories(container) {
  if (!container) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let timer = null;
  let isPaused = false;

  const startCycle = () => {
    clearInterval(timer);
    timer = setInterval(() => {
      if (isPaused) return;
      const cards = container.querySelectorAll('.story');
      if (!cards.length) return;
      
      const scrollLeft = container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;
      const nextScroll = scrollLeft + 220;
      
      if (scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollTo({ left: nextScroll, behavior: 'smooth' });
      }
    }, 4500);
  };

  container.addEventListener('mouseenter', () => { isPaused = true; });
  container.addEventListener('mouseleave', () => { isPaused = false; });
  container.addEventListener('focusin', () => { isPaused = true; });
  container.addEventListener('focusout', () => { isPaused = false; });
  container.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
  container.addEventListener('touchend', () => { isPaused = false; });

  startCycle();
}

// Sound + haptics (off switch remembered in localStorage).
let ac;
export const muted = () => localStorage.getItem('myf-mute') === '1';
export const setMuted = (m) => localStorage.setItem('myf-mute', m ? '1' : '0');
export function sfx(kind) {
  if (muted()) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'lvl' ? [523, 659, 784, 1047] : [880];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * 0.09;
      o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.3);
    });
    navigator.vibrate?.(kind === 'lvl' ? [30, 40, 60] : 15);
  } catch { /* audio blocked until first user gesture */ }
}

