// Deterministic Why-Receipt. Groq may reword it (ai/groq.js) but this is the fallback and the source of facts.
export const receipt = (card, option, by, reactionDays) =>
  `${card.agent.toUpperCase()}: "${card.title}". Evidence: ${card.why.join('; ')}. ` +
  `Chose "${option.label}" (cost ₹${option.costInr}, risk ${option.risk}) by ${by} after ${reactionDays} day(s).`;
