import { inr } from '../agents/card.js';

const ROLE = { collector: 'Collections', treasurer: 'Treasury', sentinel: 'Risk & Fraud', scout: 'Growth' };
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

// Textual rendering only (textContent) so sim strings can never inject HTML.
export function renderCards(box, cards, day, onPick) {
  box.textContent = '';
  document.getElementById('c-count').textContent = cards.length;
  if (!cards.length) box.append(el('p', { className: 'mu', textContent: 'No open decisions. Your team is monitoring.' }));
  for (const c of cards) {
    box.append(el('div', { className: 'card' + (c.urgent ? ' urgent' : '') },
      el('span', { className: 'exp', textContent: `${c.expiresDay - day}d left · confidence ${Math.round(c.confidence * 100)}%` }),
      el('span', { className: 'role ' + c.agent, textContent: ROLE[c.agent] }),
      el('h4', { textContent: c.title }),
      el('ul', {}, ...c.why.map((w) => el('li', { textContent: w }))),
      ...c.options.map((o, i) => el('button', { className: 'opt' + (i === 0 ? ' rec' : ''), onclick: () => onPick(c.id, i) },
        el('span', { textContent: (i === 0 ? 'Recommended · ' : '') + o.label }),
        el('small', {}, `cost ${inr(o.costInr)} · `, el('span', { className: 'r-' + o.risk, textContent: `${o.risk} risk` }))))));
  }
}
