// Cross-cutting UX: theme (light/dark/system), text size, high contrast, skip link, live-region, storage notice.
// Loaded by index.html (and the landing/legal pages with ?minimal). No dependencies.
import { iconSvg } from './icons.js';
const LS = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const root = document.documentElement;
const PRIVACY_URL = new URL('../legal/privacy.html', import.meta.url).href;
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

// ---- theme: 'light' | 'dark' | 'system' (default) ----
export const theme = {
  pref: () => LS.get('myf-theme', 'system'),
  resolved() { const p = this.pref(); return p === 'system' ? (mq && mq.matches ? 'light' : 'dark') : p; },
  apply() {
    root.dataset.theme = this.resolved();
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = this.resolved() === 'light' ? '#f3f6f4' : '#08110e';
    document.querySelectorAll('[data-theme-toggle]').forEach(syncButton);
  },
  set(p) { LS.set('myf-theme', p); this.apply(); },
  toggle() { this.set(this.resolved() === 'light' ? 'dark' : 'light'); },
};
if (mq) mq.addEventListener?.('change', () => theme.pref() === 'system' && theme.apply());
theme.apply();

// ---- text size + contrast ----
export const a11y = {
  fs: () => LS.get('myf-fs', 'md'), contrast: () => LS.get('myf-contrast', 'normal'),
  apply() { root.dataset.fs = this.fs(); root.dataset.contrast = this.contrast(); },
  setFs(v) { LS.set('myf-fs', v); this.apply(); }, setContrast(v) { LS.set('myf-contrast', v); this.apply(); },
};
a11y.apply();

const SUN = iconSvg('sun', 16), MOON = iconSvg('moon', 16);
function syncButton(b) {
  const light = theme.resolved() === 'light';
  b.innerHTML = (light ? MOON : SUN) + `<span class="theme-label">${light ? 'Dark' : 'Light'}</span>`;
  b.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode'); b.title = b.getAttribute('aria-label');
}
export function themeButton() {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'theme-btn'; b.dataset.themeToggle = '';
  b.addEventListener('click', () => theme.toggle()); syncButton(b); return b;
}

// ---- appearance card for Settings (used by views.js) ----
export function appearanceCard(h) {
  const seg = (items, get, set) => {
    const box = h('div', { class: 'seg', role: 'group' });
    const paint = () => [...box.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === get())));
    items.forEach(([v, label]) => box.append(h('button', { type: 'button', 'data-v': v, onclick: () => { set(v); paint(); } }, label)));
    paint(); return box;
  };
  const row = (title, sub, ctl) => h('div', { class: 'opt-row' }, h('div', {}, h('b', {}, title), h('small', {}, sub)), ctl);
  return h('section', { class: 'card' }, h('h3', {}, 'Appearance & accessibility'),
    row('Theme', 'Light, dark, or follow your device', seg([['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']], () => theme.pref(), (v) => theme.set(v))),
    row('Text size', 'Larger text across the app', seg([['md', 'Normal'], ['lg', 'Large'], ['xl', 'Extra large']], () => a11y.fs(), (v) => a11y.setFs(v))),
    row('High contrast', 'Stronger borders and text for low vision', seg([['normal', 'Off'], ['high', 'On']], () => a11y.contrast(), (v) => a11y.setContrast(v))));
}

// ---- boot-time DOM helpers (skip to content, live regions, theme button, footer, storage notice) ----
function boot() {
  if (!document.querySelector('.skip-link') && document.getElementById('view')) {
    const a = document.createElement('a'); a.className = 'skip-link'; a.href = '#view'; a.textContent = 'Skip to main content';
    a.addEventListener('click', (e) => { e.preventDefault(); const v = document.getElementById('view'); v.setAttribute('tabindex', '-1'); v.focus(); });
    document.body.prepend(a);
  }
  const t = document.getElementById('toasts'); if (t) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); }
  const actions = document.querySelector('.top-actions');
  if (actions && !actions.querySelector('[data-theme-toggle]')) actions.prepend(themeButton());
  if (!LS.get('myf-notice', '')) {
    const n = document.createElement('div'); n.className = 'notice'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'Storage notice');
    n.innerHTML = '<p>We use your browser\'s storage only to keep you signed in and remember your settings. No advertising or tracking cookies. <a href="legal/privacy.html">Privacy notice</a></p>'.replace('legal/privacy.html', PRIVACY_URL);
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'pri'; ok.textContent = 'Got it';
    ok.addEventListener('click', () => { LS.set('myf-notice', '1'); n.remove(); }); n.append(ok); document.body.append(n);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
