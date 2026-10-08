# Mind Your Funds — progress tracker
Legend: ✅ done and tested · 🟡 done, needs your Supabase project to test · ⬜ not built

Rule: every schema change ships as a new file in `supabase/migrations/` and is listed below.

## Migrations
| # | File | What it adds | Applied to project `qljazetkcycptbcpmsdl` |
|---|------|--------------|------------------------------------------|
| 1 | `20261008000000_init_mind_your_funds.sql` | `runs`, `ledger_entries` (Practice Lab), RLS, leaderboard policy | ⬜ pending: needs owner access |
| 2 | `20261008010000_workspace.sql` | `business_profiles`, `entries` (invoices/bills), RLS | ⬜ pending |
| 3 | `20261008020000_finance_manager.sql` | expense + salary kinds, `filings`, `xp_events`, `badges`, `activity_log` (append-only), `get_leaderboard()` | ⬜ pending |
| 4 | `20261008030000_goals_and_realtime.sql` | `monthly_goal` on profiles, realtime for entries/filings/xp | ⬜ pending |
| 5 | `20261008040000_recurring.sql` | `recurring` templates (rent, payroll, subscriptions) | ⬜ pending |
| 6 | `20261008050000_oxro_org_workspace.sql` | Company workspace: `orgs`, `org_members` (admin/finance/viewer), invite codes + email-domain lock, `parties`, entry approvals (server-enforced trigger), org-wide RLS, team leaderboard | ⬜ pending |

Apply all six: `npx supabase login` (project owner) → `npx supabase link --project-ref qljazetkcycptbcpmsdl` → `npx supabase db push`.
Also: Auth → enable Email provider (turn "Confirm email" off for instant sign-up), add redirect URLs, put `SUPABASE_ANON_KEY` in `.env`, run `npm run sync-env`.

## Finance manager (`index.html`, `app/`)
| Area | Status |
|------|--------|
| Sign-in: email+password, magic link, demo mode | 🟡 UI done; demo mode ✅ |
| All data in Supabase (entries, filings, XP, badges, audit log, profile) via one repo layer | 🟡 (cloud adapter written; demo adapter tested ✅) |
| Transactions: sales, purchases, expenses, payroll; GST split; mark paid; delete; CSV export | ✅ |
| GSTIN validation (checksum) and supply-type detection | ✅ |
| Dashboard: health score, KPIs, alerts with actions, quests, 6-month chart, next-14-days | ✅ |
| Alerts: overdue invoices, bills due, ITC at risk, duplicates, unusually large bills, filings | ✅ |
| GST & Compliance: filing calendar (GSTR-1 / 3B), monthly CGST/SGST/IGST position, ITC, interest estimate | ✅ |
| Payment reminder text (copy for WhatsApp/email) | ✅ |
| Gamification: XP, 7 levels, daily streak, 4 quests, 11 badges, level-up toasts | ✅ |
| Leaderboard (opt-in nickname, via `get_leaderboard()`) | 🟡 |
| Audit trail: hash-chained, verify, export, "why" on every action | ✅ (demo) 🟡 (cloud) |
| Insights: AI CFO (Groq) + 30-day stress test | ✅ stress test · 🟡 AI needs Groq model enabled |
| Fintech-style UX: business card hero, story cards, animated counters, confetti, scratch-card daily reward, goal ring, mobile bottom nav | ✅ |
| Monthly goal + Goal Crusher badge | ✅ (goal saved in profile; column needs migration 4 in cloud) |
| Realtime sync across devices/tabs, new-day rollover | 🟡 |
| Onboarding checklist (4 steps) on dashboard | ✅ |
| Bank statement CSV import with auto-reconcile by amount | ✅ (demo) 🟡 (cloud) |
| Recurring entries, auto-created monthly | ✅ (demo; table needs migration 5 in cloud) |
| Sound + haptics (toggle), installable PWA icons, offline shell | ✅ |
| **Oxro Labs internal tool**: shared company workspace, roles (admin / finance / viewer), invite code, optional email-domain lock | ✅ demo (role switcher) · 🟡 cloud |
| Approvals: non-admin spend above the limit waits for admin; pending items excluded from cash/GST/health; server trigger enforces it | ✅ demo · 🟡 cloud |
| Customers & vendors directory; GSTIN autofill; WhatsApp/email reminders from saved contacts | ✅ |
| Printable GST tax invoice (print / save as PDF) | ✅ |
| Reports: P&L by month and category, receivables/payables aging, top customers/vendors, GST by month, print + CSV | ✅ |
| Team page: members, roles, remove, invite code, approval limit | ✅ demo · 🟡 cloud |
| Company-wide audit trail for admins (who did what and why) | ✅ demo · 🟡 cloud |
| Practice Lab (the 90-day simulation, `lab.html`) | ✅ |
| Self-checks: `npm run check` (GST, ledger, workspace math, sim) | ✅ |

## Known limits
- XP is awarded by the client (capped per event, unique per kind+ref). A determined user could cheat their own score; move to a Postgres function if this matters.
- GST rates and due dates are planning estimates in `tax/config.js`. Verify with a CA.
- No bank feed, e-invoicing, TDS/PF workflows yet.

## Not built yet
⬜ Recurring entries · ⬜ Multi-user / accountant access · ⬜ Receipt uploads (Supabase Storage) · ⬜ Bank statement import · ⬜ Email/WhatsApp sending (reminders are copy-paste)
