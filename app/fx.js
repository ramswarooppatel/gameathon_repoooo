// Delight layer: confetti, count-up numbers, scratch card. No dependencies.
export function confetti(n = 110) {
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
