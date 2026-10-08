# Mind Your Funds — Next steps

This is the working plan from "code on my laptop" to "demo-ready, data in Supabase". Do the steps in order. Status of every feature and migration lives in [PROGRESS.md](PROGRESS.md).

## 0. What exists today
- **Finance manager** (`index.html`, `app/`): transactions, GST (CGST/SGST/IGST + input credit), filing calendar, alerts with one-click actions, AI CFO, audit trail, sign-in, demo mode.
- **Engagement layer** (the Slice / FamPay-style feel, on real finance habits): business card hero, story cards, animated numbers, daily quests, scratch-card reward, XP + 7 levels, streaks, 11 badges, monthly goal ring, leaderboard, confetti, mobile bottom navigation.
- **Practice Lab** (`lab.html`): the 90-day simulation, kept as a training mode.
- **Not connected yet:** your Supabase project. Everything works in demo mode (browser storage) until you do step 1.

## 1. Connect Supabase (blocker, ~10 min)
The CLI and connector I use are signed in to a different account than the one that owns `qljazetkcycptbcpmsdl`, so this must be done by the project owner.

1. `npx supabase login` with the owner account.
2. `npx supabase link --project-ref qljazetkcycptbcpmsdl` (asks for the DB password).
3. `npx supabase db push`. Applies the six files in `supabase/migrations/` in order.
4. Dashboard → **Authentication → Providers**: enable Email. For instant sign-up, turn **Confirm email** off (hackathon only; turn back on for real users).
5. Dashboard → **Authentication → URL Configuration**: add `http://localhost:3000` and your deployed URL as redirect URLs.
6. Dashboard → **Settings → API**: copy the **anon / publishable** key into `.env` as `SUPABASE_ANON_KEY`. Never use `service_role`.
7. `npm run sync-env` (writes `config.js`), then `npx netlify-cli dev`.
8. Sign up in the app. Add a transaction. In the Supabase table editor you should see rows in `entries`, `xp_events`, `activity_log`.

**Done when:** a transaction added on your laptop appears on your phone after sign-in, and the Audit trail says "Verified".

## 1b. First run as Oxro Labs (after step 1)
1. Sign up with your `@oxrolabs.com` email. The app asks you to **create the workspace** (you become admin). Leave "Only allow emails from this domain" as `oxrolabs.com`.
2. Team & access → copy the **invite code** and send it to teammates. They sign up, choose "Join with code", and arrive as **Viewer**. Promote them to Finance or Admin.
3. Team & access → set the **approval limit** (default ₹25,000). Finance users' spend above it waits for an admin in Approvals.
4. Settings → fill company name, GSTIN, opening balance, monthly goal.

Roles: **Admin** everything · **Finance** add/edit transactions, parties, filings, reconcile · **Viewer** read only. These are enforced in the database (RLS + triggers), not just the UI.

## 1c. Load sample data into the database (optional)
After step 1b (the workspace must exist), run the seed. It adds 5 customers/vendors, 14 transactions (one overdue, one with a bad GSTIN), a recurring rent, 2 filings, a check-in streak, and sets the company GSTIN, opening balance and goal. Dates are relative to today, and re-running is a no-op.

```bash
npx supabase db query --linked -f supabase/seed.sql
```
Or paste `supabase/seed.sql` into the Supabase SQL editor and run it. (The in-app Settings → "Load sample data" button does the same thing from the browser, as the signed-in user.)

## 2. Verify the cloud path (30 min)
I only tested demo mode. Run this checklist with a real account and tell me what fails:
- [ ] Sign up, sign in, sign out, magic link; create workspace; second account joins by invite code and lands as Viewer.
- [ ] As Viewer: no add/edit buttons, and a direct API insert is rejected (RLS).
- [ ] As Finance: a ₹50,000 purchase becomes *pending*; as Admin, approve it in Approvals; try approving as Finance (must fail).
- [ ] A teammate from another email domain cannot join.
- [ ] Add each type: sale, purchase, expense, salary. Totals and GST match a hand calculation.
- [ ] Mark paid, delete, copy reminder.
- [ ] Mark a GSTR-1 and GSTR-3B filed. Late filing gives no XP.
- [ ] Open the app in two tabs. Add an entry in one; the other updates within a second (realtime).
- [ ] Opt in to the leaderboard with a second account; both appear.
- [ ] Audit trail → Verify chain → "Verified". Then, in the SQL editor, edit one `activity_log.why` and verify again: it must say "Tampered".
- [ ] Supabase **Advisors** (security): no warnings except the intended `get_leaderboard` function.

## 3. Make it feel finished (hackathon polish, 2–4 h)
Priority order. Each item is small and independent.
1. **Seed story for the demo.** Use Settings → Load sample data, then rehearse the 3-minute flow: dashboard → overdue story → copy reminder → mark paid (XP + level up) → file GSTR-3B → scratch card → Audit trail verify.
2. **Groq model.** Enable a model in your Groq project (or set `GROQ_MODEL` to one that works). Until then the CFO uses the offline fallback.
3. **Deploy.** Netlify: connect the repo, set env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`. The build runs `sync-env` automatically.
4. **Install as an app.** Add 192/512 px icons to `manifest.webmanifest` (currently the 1254 px logo) and a tiny service worker for offline shell.
5. **Empty-state onboarding.** First sign-in: 3-step checklist (profile, first invoice, first filing) with an XP bar. Reuses the existing quest/badge code.
6. **Sound + haptics.** A soft tick on XP, a chime on level-up, `navigator.vibrate(20)` on mobile.

## 4. Product roadmap (after the hackathon)
| Priority | Feature | Why it matters | Approach |
|---|---|---|---|
| High | Server-side XP | Today XP is awarded by the browser; users could inflate their own score | Postgres function `award_xp(kind, ref)` that validates against real data; remove the insert policy |
| Done | Bank statement import (CSV), recurring entries, onboarding, sound/haptics, PWA | Built in phase 2 | See PROGRESS.md |
| High | Real reminders | Copy-paste is a friction point | Supabase Edge Function + WhatsApp Business / email provider; every send logged in `activity_log` |
| Medium | Receipts / invoice PDFs | Proof for audits | Supabase Storage bucket + `attachment_path` on `entries` |
| Medium | Accountant access | CA reviews and files | `business_members` table with roles and RLS |
| Medium | TDS, PF/ESI, advance tax | Completes the compliance calendar | Extend `filings.type` and `tax/config.js` |
| Medium | GST rate correctness | Rates change | Move `tax/config.js` into a table with effective dates; CA-reviewed |
| Low | Real on-chain anchor | The ledger is tamper-evident, not a blockchain | Publish the latest hash weekly to a public testnet / signed timestamp |
| Low | Teams & shared goals | Engagement | Team leaderboards, weekly challenges |

## 5. How the gamification works (for the pitch)
- **Principle:** points reward behaviours that make a business healthier, not time spent in the app.
- **XP:** check-in 10 · transaction 5 · paid on time 15 · return filed on time 40 · alert resolved 10 · badge 25 · daily scratch card 10–50.
- **Loops:** daily quests → scratch reward (variable reward) → streak (habit) → levels and badges (progress) → monthly goal ring (a target to chase) → leaderboard (social, opt-in).
- **Safety rails:** no XP for deleting or back-dating; late filings earn nothing; all actions land in the hash-chained audit trail.
- **Answers to judges:** *Is it a game?* No, it's a finance tool with game mechanics. *Does it change behaviour?* Overdue collections, on-time filing and daily bookkeeping are the XP sources. *Is the owner in control?* Nothing happens without a click, and every action has a recorded reason.

## 6. Risks to watch
- **Email sign-up limits.** Supabase's built-in email sender is heavily rate-limited. For the demo use password sign-up with "Confirm email" off, or configure SMTP.
- **Tax figures are estimates.** Keep the "verify with a CA" notice visible.
- **Client-side XP** (see roadmap). Fine for a demo; fix before real users.
- **Groq model access** differs per project; the function falls back across models and then to offline text.

## 7. Every time the schema changes
1. Create a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_what_changed.sql`.
2. Add a row to the table in `PROGRESS.md`.
3. `npx supabase db push`. Never edit an already-applied migration.
