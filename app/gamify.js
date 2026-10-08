// Engagement layer (pure). XP comes from real finance habits; nothing here is a game world.
import { validGstin } from '../tax/gst.js';
import { addDays } from '../workspace/calc.js';
import { payrollStreak } from '../workspace/payroll.js';

export const LEVELS = [[0, 'Starter'], [100, 'Tracker'], [250, 'Planner'], [500, 'Controller'], [900, 'Strategist'], [1500, 'Finance Lead'], [2400, 'CFO']];
export const XP = { checkin: 10, entry_added: 5, paid_on_time: 15, filing_on_time: 40, alert_resolved: 10, profile_complete: 30, badge: 25, payroll_run: 20, payroll_on_time: 40, payroll_ready: 30 };

export function levelOf(xp) {
  let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const lo = LEVELS[i][0], hi = LEVELS[i + 1]?.[0];
  return { n: i + 1, name: LEVELS[i][1], next: LEVELS[i + 1]?.[1] ?? null, pct: hi ? Math.round(((xp - lo) / (hi - lo)) * 100) : 100, toNext: hi ? hi - xp : 0 };
}

// Consecutive check-in days ending today (or yesterday, so the streak isn't lost before you open the app).
export function streakOf(events, today) {
  const days = new Set(events.filter((e) => e.kind === 'checkin').map((e) => e.day));
  let d = days.has(today) ? today : addDays(today, -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export const QUESTS = [
  { id: 'checkin', title: 'Daily check-in', desc: 'Open your finance dashboard', xp: 10, done: (c) => c.has('checkin', c.today) },
  { id: 'log', title: 'Log 2 transactions', desc: 'Keep your books current', xp: 20, done: (c) => c.countToday('entry_added') >= 2, progress: (c) => `${Math.min(2, c.countToday('entry_added'))}/2` },
  { id: 'resolve', title: 'Resolve one alert', desc: 'Collect, pay or file something', xp: 25, done: (c) => c.countToday('alert_resolved') >= 1 },
  { id: 'routine', title: 'Finish the daily routine', desc: 'Complete all 5 steps on Today', xp: 20, done: (c) => c.has('daily_routine', c.today) },
  { id: 'clean', title: 'Zero overdue invoices', desc: 'Collect everything that is past due', xp: 30, done: (c) => c.sum.receivable > 0 && c.sum.overdueCount === 0 },
];

const filedOnTime = (c) => c.filings.filter((f) => f.filed_date && f.filed_date <= f.due_date);
export const BADGES = [
  { code: 'first_entry', title: 'First Entry', desc: 'Record your first transaction', test: (c) => c.entries.length >= 1 },
  { code: 'profile', title: 'Business Ready', desc: 'Add your business name and valid GSTIN', test: (c) => !!c.profile.name && validGstin(c.profile.gstin) },
  { code: 'collector', title: 'Collector', desc: 'Get 5 invoices paid', test: (c) => c.sum.paidSales >= 5 },
  { code: 'tax_ready', title: 'Tax Ready', desc: 'File a return on time', test: (c) => filedOnTime(c).length >= 1 },
  { code: 'compliance_pro', title: 'Compliance Pro', desc: 'File 3 returns on time', test: (c) => filedOnTime(c).length >= 3 },
  { code: 'cash_fortress', title: 'Cash Fortress', desc: 'Hold 3+ months of runway', test: (c) => c.sum.cash > 0 && c.sum.runwayMonths >= 3 },
  { code: 'clean_books', title: 'Clean Books', desc: 'No overdue invoices with 5+ entries', test: (c) => c.entries.length >= 5 && c.sum.overdueCount === 0 },
  { code: 'healthy', title: 'Healthy Business', desc: 'Reach a health score of 80', test: (c) => c.entries.length >= 3 && c.sum.health >= 80 },
  { code: 'goal', title: 'Goal Crusher', desc: 'Hit your monthly collection goal', test: (c) => +c.profile.monthly_goal > 0 && c.sum.collectedMonth >= +c.profile.monthly_goal },
  { code: 'scholar', title: 'Scholar', desc: 'Pass 4 money lessons', test: (c) => c.events.filter((e) => e.kind === 'lesson').length >= 4 },
  { code: 'closer', title: 'Month-End Closer', desc: 'Complete a month-end close', test: (c) => c.events.some((e) => e.kind === 'month_close') },
  { code: 'routine5', title: 'Routine Pro', desc: 'Finish the daily routine 5 times', test: (c) => c.events.filter((e) => e.kind === 'daily_routine').length >= 5 },
  { code: 'payday', title: 'Payday', desc: 'Pay your first payroll run', test: (c) => c.runs.some((r) => r.status === 'paid') },
  { code: 'payday_pro', title: 'Payday Pro', desc: 'Pay salaries on time 3 months in a row', test: (c) => c.payrollStreak >= 3 },
  { code: 'dues_clean', title: 'Dues Cleared', desc: 'Remit PF, ESI, TDS or PT on time 3 times', test: (c) => c.entries.filter((e) => e.category === 'Statutory dues' && e.paid_date && e.due_date && e.paid_date <= e.due_date).length >= 3 },
  { code: 'streak3', title: 'On a Roll', desc: '3-day check-in streak', test: (c) => c.streak >= 3 },
  { code: 'streak7', title: 'Habit Builder', desc: '7-day check-in streak', test: (c) => c.streak >= 7 },
];

export function makeCtx({ events, entries, filings, profile, sum, today, runs = [] }) {
  return {
    events, entries, filings, profile, sum, today, runs, streak: streakOf(events, today), payrollStreak: payrollStreak(events, today.slice(0, 7)),
    has: (kind, day) => events.some((e) => e.kind === kind && e.day === day),
    countToday: (kind) => events.filter((e) => e.kind === kind && e.day === today).length,
  };
}
