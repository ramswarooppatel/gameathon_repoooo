// Recurring entry templates (rent, payroll, SaaS...). Pure: which months still need an entry generated.
export const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

// tpl: { day_of_month 1..28, start_month 'YYYY-MM', last_generated 'YYYY-MM'|null }
export function dueMonths(tpl, today) {
  const out = [], cur = today.slice(0, 7);
  let m = tpl.last_generated ? nextMonth(tpl.last_generated) : tpl.start_month;
  while (m <= cur) {
    const date = `${m}-${String(Math.min(tpl.day_of_month, 28)).padStart(2, '0')}`;
    if (date > today) break;
    out.push({ month: m, date });
    m = nextMonth(m);
  }
  return out;
}
