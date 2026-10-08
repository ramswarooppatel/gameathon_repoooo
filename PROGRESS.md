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
| 7 | `20261008060000_workflow.sql` | `orgs.budgets`, `checklist_ticks` (weekly + month-end checklist state) | ⬜ pending |
| 8 | `20261009000000_invoicing.sql` | `invoices` (immutable once issued), `items`, `orgs.invoice_settings`, unique GSTIN per workspace, `parties.address/pincode`, `entries.invoice_id`, `is_buyer()`, `respond_invoice()` | ⬜ pending |
| 9 | `20261010000000_rewards_pool.sql` | `rewards`, `redemptions`, `orgs.reward_pool_monthly`; trigger enforces XP balance and the monthly pool | ⬜ pending |
| 10 | `20261011000000_payroll.sql` | `employees`, `payroll_runs`, `payslips` (admin and finance only), maker-checker approval trigger, payslip lock, `entries.payroll_run_id`, `orgs.payroll_settings` | ⬜ pending |

Apply all ten: `npx supabase login` (project owner) → `npx supabase link --project-ref qljazetkcycptbcpmsdl` → `npx supabase db push`.
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
| Gamification: XP, 7 levels, daily streak, 5 quests, 14 badges, level-up toasts | ✅ |
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
| **SaaS polish (phase 3):** light / dark / auto theme, text size, high-contrast, skip link, storage notice (`app/extras.js`, `app/theme.css`, generated `app/theme-light.generated.css`) | ✅ |
| Legal pages: Terms, Privacy Notice (DPDP-aligned), Disclaimer, Accessibility statement (`legal/*`, generated by `scripts/gen_site.py`); consent checkbox + terms version stored on sign-up | ✅ draft: fill highlighted placeholders, lawyer review before public launch |
| Landing page `welcome.html`: hero, cited stats, 6 novelty cards, comparison, how it works, security, FAQ, references | ✅ |
| Missing component styles added (`app/components.css`): streak strip, badge and level modals, XP pop | ✅ |
| UI smoke test `python scripts/ui_smoke.py`: 12 pages x 3 roles x light/dark x 375/768/1440 + landing and legal pages | ✅ passes |
| **Guided workflow (`#today`)**: 5-step daily routine, weekly checklist, month-end close (auto + manual steps), smart tips with reasons, XP for finishing | ✅ demo · 🟡 cloud (needs migration 7) |
| **Cash planner (`#planner`)**: 60-day forecast from each customer's usual delay, 3 scenarios + what-if slider, pay-first ranking, collections ladder, category budgets vs actual | ✅ demo · 🟡 cloud |
| **Learn (`#learn`)**: 8 money lessons with quizzes (pass 2/3 = 25 XP), Scholar badge | ✅ |
| Command palette (Ctrl/⌘+K), smoother page transitions, a11y attributes now actually set (`aria-*`, `role`, `tabindex`) | ✅ |
| End-to-end test `python scripts/flow_test.py` (workflow, planner, lesson, palette, theme) | ✅ passes |
| **Apple-style UI pass**: no emoji anywhere in the app (outline SVG icon set in `app/icons.js`), calm surfaces, hairline borders, translucent sidebar/top bar, pill buttons, segmented controls, compact icon-only top bar on phones (`app/apple.css`) | ✅ |
| **Performance**: CSS bundled + minified (`app/bundle.min.css`, 14 KB gzip), logo 414 KB to 9 KB, landing screenshots JPG to WebP (880 to 220 KB), stale-while-revalidate service worker, preconnect | ✅ |
| Practice Lab (the 90-day simulation, `lab.html`) | ✅ |
| Self-checks: `npm run check` (GST, ledger, workspace math, sim) | ✅ |

## Invoicing (page `#invoices`, `app/views4.js`, `tax/invoice.js`, `tax/eway.js`)
| Area | Status |
|------|--------|
| Multi-line GST tax invoice and bill of supply: HSN/SAC, qty, discount, per-line GST rate, CGST/SGST vs IGST by place of supply, HSN summary, round-off, amount in words | ✅ tested (`core/selfcheck.js`, `scripts/invoice_test.py`) |
| FY-aware numbering (`INV/26-27/0001`, 16-char rule), drafts, issue locks the invoice, admin-only cancel | ✅ |
| Issuing creates the sale entries (one per GST rate), so GST, reports, planner and aging pick them up | ✅ |
| Print / PDF layout (A4), seller bank and UPI, notes and terms | ✅ |
| E-way bill: requirement check, validity, validation, NIC bulk-upload JSON, save the bill number | ✅ (the bill itself is generated on the NIC portal) |
| Received invoices: import a file, or inbox of invoices sent to your GSTIN; accept creates purchase entries with ITC, reject notifies the sender | ✅ demo; cloud path ⬜ untested until migration 8 is applied |
| PDF download of any issued invoice (own dependency-free writer, `app/pdf.js`; amounts print as Rs.), from the invoice list, share dialog and transactions | ✅ (`core/selfcheck.js`, `scripts/txn_test.py`) |
| Add-transaction dialog: type picker, GST-included or before-GST amount, live summary and cash effect, quick due dates, already-paid, save and add another; sales point to Invoices | ✅ |
| Invoices and transactions linked: invoice rows open from Transactions, delete is blocked (cancel the invoice instead), Entries button on each invoice | ✅ |
| Item catalog, full JSON backup, shortcuts (`?`, `i`, `n`, `/`, `g` + letter, Ctrl+S, Ctrl+Enter) | ✅ |
| Limits | GSTIN ownership is not verified, so a buyer inbox trusts the GSTIN a workspace claims. No credit notes, e-invoice (IRN) or TCS/TDS yet. |

## Compliance, navigation, rewards funding
| Area | Status |
|------|--------|
| Grouped navigation (one config in `app/nav.js` renders sidebar, phone bar and More sheet; aria-current, 40px+ targets) | ✅ |
| Compliance page: readiness score from live checks, due-date calendar with tick-off, one-time registrations, ISO 27001/27701/9001/8601/20022, WCAG 2.2, DPDP, CGST rules mapped to what is built, evidence pack download | ✅ (aligned, not certified) |
| Rewards store: company monthly pool, reward catalog, XP redemption, admin approval, delivery; DB-enforced balance and pool cap | ✅ demo (`scripts/rewards_test.py`); cloud ⬜ until migration 9 |
| Who pays: points free; company funds cash rewards; partner perks planned and labelled | ✅ explained in app |
| Limits | XP is still awarded client-side, so approval plus the pool cap bound the loss. No two-step sign-in, ISO 20022 import or e-invoice yet. |

## Payroll (page `#payroll`, `tax/payroll.js`, `workspace/payroll.js`, `app/views6.js`, `app/payslip.js`)
| Area | Status |
|------|--------|
| Employees: salary structure (basic, HRA, allowances), PF, ESI, professional tax, TDS flags, PAN/UAN/bank, joiners and leavers, CSV import with template | ✅ |
| Statutory maths: PF 12% on the ₹15,000 wage ceiling with EPS split and admin/EDLI, ESI 0.75% / 3.25%, professional tax (MH, KA, GJ, TN, flat), TDS estimate (new regime, 87A rebate, cess), loss of pay, auto proration | ✅ planning estimates, tested in `core/selfcheck.js` |
| Monthly run: attendance and one-off items, live payslips, readiness checks, cash-after-payroll warning, draft, submit, approve, mark paid, locked once approved | ✅ (`scripts/payroll_test.py`) |
| Maker-checker: finance prepares, an admin approves; DB trigger stops the preparer approving when another admin exists | ✅ cloud ⬜ untested until migration 10 |
| Books link: approval creates the salary entry and PF, ESI, TDS, PT dues with the right due dates, so the cash planner and Compliance see them; payroll entries cannot be deleted by hand | ✅ |
| Files: payslip PDF (one page per employee), bank transfer CSV, payroll register CSV, PF ECR text | ✅ ECR and bank formats are planning aids: validate on the portal or with your bank |
| Gamification: payroll streak, badges Payday, Payday Pro, Dues Cleared, XP for preparing a run (20), paying on time (40), complete employee data (30), and paying dues on time | ✅ |
| Access: admin and finance only (RLS); viewers see a restricted notice | ✅ |
| Not built | Form 16 / 24Q, leave management, reimbursement claims workflow, loans schedule, gratuity and bonus acts, automatic bank payments, salary revisions history, multi-state PT per employee beyond the table |

## Practice Lab coach (`ui/coach.js`, `ui/cards.js`, `lab.js`)
| Area | Status |
|------|--------|
| Cards tell a short story: What is happening, Why it matters, from facts the agents attach (`topic`, `facts`), plus the crew member's skill | ✅ |
| Recommended option explained from the card's numbers; label stays on `options[0]` (see note), and "If you do not decide in N days: <default>" uses `defaultOption` | ✅ |
| Decision impact from real engine state (payment day moved, fee paid, fraud blocked or lost, cash, business health before and after) | ✅ |
| Existing lessons reused: "What you learned" is the lesson's own takeaway; "Open lesson" goes to Learn and remembers the lesson id | ✅ opening that exact lesson in Learn needs a small hook in `views3.js` (request in TODO.md) |
| Ghost Twin reveal at the end: same business, same events, side-by-side health, cash, lowest cash, missed obligations, penalties, fraud; verdict is honest if the twin wins | ✅ (`scripts/lab_test.py`) |
| Previous Day (rewind one day advance): deep snapshots of both games before each Next day, restored together with the random generator position; Auto-play pauses; New Run clears the history; autonomy settings are kept; the audit ledger stays append-only; nothing is saved to Supabase | ✅ (`scripts/lab_test.py`, with a negative control proving the generator restore matters) |
| Note | `defaultOption` is what the engine applies when a card expires (for the fraud card it is "Pay anyway"), so it is NOT the recommendation. Treasurer's big-bill card always recommends "Negotiate +10 days" even when cash is fine; the coach says so honestly. Reordering that card's options is a possible follow-up. |

## Back navigation (`app/main.js`, `lab.js`, `scripts/gen_site.py`)
| Area | Status |
|------|--------|
| In-app pages: "Back" above the title of every page except Today; reuses browser history (depth kept in `history.state`), falls back to Today in place on deep links, so Back never leaves the app or shows a blank page; a screen that has its own Back (invoice form) keeps only that one | ✅ (`scripts/nav_test.py`) |
| Practice Lab: Start and End overlays get "Go Back" (closes the overlay only; no start, no reset); the existing "Finance Desk" link stays | ✅ |
| Landing and legal pages: Back link (history when you came from another page, otherwise the app) | ✅ |
| Dialogs: already have Close, Cancel or X; the `?` shortcuts help has none yet (Esc works), left for the dialog unification | ⬜ |

## Seed data
`supabase/seed.sql`: sample company data (parties, entries, recurring, filings, XP). ⬜ not run: needs your project + a created workspace. Not covered by migrations on purpose (so production stays clean).

## Build step
After editing any file in `app/*.css` run `npm run build:css` (the app loads `app/bundle.min.css`). `npm run build:site` also regenerates the light-theme overrides and the landing/legal pages.

## Known limits
- XP is awarded by the client (capped per event, unique per kind+ref). A determined user could cheat their own score; move to a Postgres function if this matters.
- GST rates and due dates are planning estimates in `tax/config.js`. Verify with a CA.
- No bank feed, e-invoicing, TDS/PF workflows yet.

## Not built yet
⬜ Recurring entries · ⬜ Multi-user / accountant access · ⬜ Receipt uploads (Supabase Storage) · ⬜ Bank statement import · ⬜ Email/WhatsApp sending (reminders are copy-paste)
