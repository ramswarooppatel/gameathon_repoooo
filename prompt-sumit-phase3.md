# Sumit — Phase 3 prompt (paste into your AI assistant)

Context: you finished tasks 1–6 of `prompt.md` and Ram merged `sumit/ui-phase-2` into `main` (merge commit `003841c`, follow-up fixes `fc21532`). Product: **Oxro Labs · Finance Desk** (by Mind Your Funds), a gamified internal finance tool. Style target: Slice / FamPay, professional, not childish.

**Start here**
```bash
git checkout main && git pull
git checkout -b sumit/ui-phase-3
npx serve .                      # http://localhost:3000 → "Continue in demo mode" → Settings → "Load sample data"
node core/selfcheck.js           # must print: selfcheck OK
python scripts/ui_smoke.py       # must print: UI SMOKE OK   (pip install playwright; uses Microsoft Edge)
```
Read `GOD_PROMPT.md`, `PROGRESS.md`, and the previous `prompt.md` rules. They all still apply.

## Boundaries (unchanged)
**You may edit:** `index.html`, `app/app.css`, `app/fx.js`, `app/views.js`, `app/views2.js`, `public/*`, `manifest.webmanifest`, `sw.js`, `offline.html` (new), `lab.html` + `style.css` + `ui/*`, `docs/*.png`.
**Do not edit:** `app/main.js`, `app/repo.js`, `app/gamify.js`, `app/bank.js`, `app/recurring.js`, `app/reports.js`, `app/invoice.js`, `workspace/*`, `core/*`, `agents/*`, `tax/*`, `ledger/*`, `db/*`, `ai/*`, `netlify/*`, `supabase/*`, `scripts/*` (except adding a new test script), `.env*`.
Need data or an action that does not exist? Write the view against the existing `S` / `A` objects and log the request under **Requests between owners** in `TODO.md`.

## Tasks (in order; each has a "done when")

### 1. Fix the two known layout bugs (≈45 min)
- At **375 px** the dashboard scrolls sideways by **57 px** and `#styleguide` by **6 px**. Find the elements (`.stories`, `.bizcard`, KPI sparklines, wide tables or chips are the usual suspects). Use `min-width: 0` on grid/flex children, `overflow-x: auto` only on intentional scrollers (stories, tables), and wrap long text.
- **Done when:** `python scripts/ui_smoke.py` prints `UI SMOKE OK` (no horizontal overflow at 375 / 768 / 1440 px on every page, no console errors, all three roles).

### 2. Top bar and nav accuracy (≈45 min)
- The new top bar has `#role-pill`, `#snd-label` and a breadcrumb. `main.js` does not know about the first two, so verify by hand: switch role (Team & access → "Demo: switch role") and toggle sound. If the pill or label is wrong or stale, **do not edit `main.js`**: update them yourself from `index.html`'s inline script by reading `#who` text and `localStorage['myf-mute']`, and add a `MutationObserver` on `#who`.
- Hide nav items a role cannot use on **both** the desktop sidebar and the mobile drawer (`data-role="admin"` on Team must hide for finance/viewer in both).
- **Done when:** the pill and sound label are correct after every role switch and reload, in sidebar and mobile drawer.

### 3. Task 7 from the last prompt: PWA and speed (≈1.5 h)
- `manifest.webmanifest`: add a maskable icon entry and a `screenshots` array (use 2 wide + 2 narrow images saved in `public/`; take them from the demo data).
- `sw.js` + new `offline.html`: when a navigation fails and nothing is cached, show a branded offline page (logo, "You're offline", Retry button). Keep the existing network-first strategy.
- Lighthouse (mobile, Chrome DevTools): **Performance ≥ 85, Accessibility ≥ 95, installable**. Fix what it flags in your files only (image sizes, `loading="lazy"`, contrast, missing `aria-*`, tap-target size).
- **Done when:** `docs/lighthouse.png` is saved showing the scores, and Chrome offers "Install app".

### 4. Sign-in, workspace setup and error screens (≈1.5 h)
These are rendered by `main.js` into `#auth .modal` using classes you control, so style them from CSS without touching JS:
- **Sign-in modal:** brand header, clear primary button ("Sign in"), secondary actions ("Create account", "Email me a link"), a visually separate "Continue in demo mode" with a small "Demo data stays in this browser" note, error text style, loading state on buttons while "Working…".
- **Workspace setup modal** ("Set up your workspace"): two clearly separated sections (Create workspace · Join with code), input hints, readable on 375 px.
- **"Database not ready"** screen: friendly layout with the message, the migration hint and Reload / Sign out buttons.
- **Done when:** all three look designed, work with keyboard only, and fit 375 px without scrolling the page body.

### 5. Empty, loading and error states everywhere (≈1.5 h)
- Every page needs a designed **empty state** (inline SVG + one sentence + a button that goes somewhere useful): Transactions, Parties, Approvals, Reports, Audit, Rewards leaderboard, Compliance (no filings).
- Skeleton loaders for first paint on Dashboard and Transactions (CSS only; shown until `#view` has content, then removed).
- A small banner when in **demo mode** ("Demo data lives only in this browser · Sign in to sync") using `#mode` text as the signal.
- **Done when:** a brand-new demo user (no sample data) sees helpful empty states on all 11 pages, and nothing looks broken or blank.

### 6. Practice Lab (`lab.html`) visual alignment (≈1 h)
- Make the Practice Lab use the same tokens, fonts, buttons and cards as the main app (reuse `app/app.css` variables; keep `lab.js` behaviour).
- Add a clear "Back to Finance Desk" link and the product logo. Keep the shop canvas (`ui/scene.js`) but match its palette.
- **Done when:** switching between the app and the lab feels like one product, and the lab works at 375 px.

### 7. Final polish and handoff assets (≈1 h)
- Consistent focus rings, hover/active states, and `:disabled` styles on every button and input.
- Keyboard pass (no mouse): add a transaction, mark paid, approve as admin, open the mobile "More" drawer, close dialogs with Esc.
- Save screenshots (desktop 1440 and phone 375) of Dashboard, Transactions, Approvals, Reports, Rewards, level-up modal, sign-in modal to `docs/screens/`. Ram will use them in the pitch.
- Remove or hide `#styleguide` from any nav (keep the route).
- **Done when:** `docs/screens/` has 14 images and the acceptance list below passes.

## Process
- Commit per task: `ui: <task> — <what>`; branch `sumit/ui-phase-3`; do not merge to `main` (Ram merges).
- After each task tick it in `TODO.md`, add one line to the **Work Log**, and add any needs under **Requests between owners**.
- Run `node core/selfcheck.js` and `python scripts/ui_smoke.py` before every commit.

## Acceptance checklist
- [ ] `selfcheck OK` and `UI SMOKE OK`
- [ ] No horizontal scroll at 375 / 768 / 1440 px on any page, as admin, finance and viewer
- [ ] Role pill, sound label and nav visibility correct after role switch and reload
- [ ] Install prompt works; `offline.html` appears when offline; Lighthouse screenshot saved
- [ ] Sign-in, workspace setup and database-error screens styled and keyboard-usable
- [ ] Empty and loading states on all 11 pages
- [ ] Practice Lab matches the main app styling
- [ ] 14 screenshots in `docs/screens/`
- [ ] No edits outside your files; no new dependencies
