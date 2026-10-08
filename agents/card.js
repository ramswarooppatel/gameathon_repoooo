// Card factory. options[0] = recommended; defaultOption = what happens if the card expires unanswered.
// topic + facts are display metadata for the Practice Lab coach (ui/coach.js); they never change decisions.
export function makeCard(g, { agent, eventId = null, title, why, options, urgent = false, ttl = 3, defaultOption = options.length - 1, confidence = 0.8, topic = null, facts = {} }) {
  const day = g.s.day;
  return { id: `c${g.nextCardId++}`, agent, eventId, title, why, options, urgent, createdDay: day, expiresDay: day + ttl, defaultOption, confidence, topic, facts };
}
export const opt = (label, costInr, effect, risk = 'low') => ({ label, costInr: Math.round(costInr), effect, risk });
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
