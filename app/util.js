import { confetti, sfx } from './fx.js';
export const $ = (s, r = document) => r.querySelector(s);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
// h('div', {class:'x', onclick}, 'text', child): text always goes in as a text node, never HTML.
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag), { class: c, ...rest } = props;
  if (c) e.className = c;
  for (const [k, v] of Object.entries(rest)) k.startsWith('data-') ? e.setAttribute(k, v) : (e[k] = v);
  e.append(...kids.flat().filter((k) => k !== false && k != null));
  return e;
}
export function toast(title, body = '', kind = '') {
  const t = h('div', { class: 'toast ' + kind }, h('b', {}, title), body);
  document.getElementById('toasts').append(t);
  if (kind === 'lvl') { confetti(); sfx('lvl'); } else if (kind === 'xp') sfx('xp');
  setTimeout(() => t.remove(), 4200);
}
