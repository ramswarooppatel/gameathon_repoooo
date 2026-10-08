import { inr } from '../agents/card.js';
import { SKILL, story, recommendWhy, injectStyles } from './coach.js';

const ROLE = { collector: 'Collections', treasurer: 'Treasury', sentinel: 'Risk & Fraud', scout: 'Growth' };
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e; };

// Textual rendering only (textContent) so sim strings can never inject HTML.
// Card contract (agents/card.js): options[0] is the RECOMMENDED option; defaultOption is what happens if the card expires unanswered.
export function renderCards(box, cards, day, onPick) {
  injectStyles();
  box.textContent = '';
  document.getElementById('c-count').textContent = cards.length;
  if (!cards.length) box.append(el('p', { className: 'mu', textContent: 'No open decisions. Your team is monitoring.' }));
  for (const c of cards) {
    const st = story(c), why = recommendWhy(c), left = c.expiresDay - day, fallback = c.options[c.defaultOption ?? c.options.length - 1];
    box.append(el('div', { className: 'card' + (c.urgent ? ' urgent' : '') },
      el('span', { className: 'exp', textContent: `${left}d left · confidence ${Math.round(c.confidence * 100)}%` }),
      el('span', { className: 'role ' + c.agent, textContent: ROLE[c.agent] }),
      el('span', { className: 'skill', textContent: SKILL[c.agent] }),
      el('h4', { textContent: c.title }),
      el('ul', {}, ...c.why.map((w) => el('li', { textContent: w }))),
      st && el('div', { className: 'story' },
        el('div', {}, el('h5', { textContent: "What's happening?" }), el('p', { textContent: st.happening })),
        el('div', {}, el('h5', { textContent: 'Why does it matter?' }), el('p', { textContent: st.matters }))),
      why && el('div', { className: 'rec-why' }, el('h5', { textContent: 'Recommended' }), el('p', {}, el('b', { textContent: c.options[0].label }), ' ' + why)),
      ...c.options.map((o, i) => el('button', { className: 'opt' + (i === 0 ? ' rec' : ''), onclick: () => onPick(c.id, i) },
        el('span', { textContent: (i === 0 ? 'Recommended · ' : '') + o.label }),
        el('small', {}, `cost ${inr(o.costInr)} · `, el('span', { className: 'r-' + o.risk, textContent: `${o.risk} risk` })))),
      fallback && el('p', { className: 'nothing', textContent: `If you do not decide in ${Math.max(0, left)} day${left === 1 ? '' : 's'}: ${fallback.label}.` })));
  }
}
