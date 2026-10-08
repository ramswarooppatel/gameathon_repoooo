# Sumit — Front-end phase prompt (paste this into your AI assistant)

You are working with **Sumit** on **Oxro Labs · Finance Desk** (a product by *Mind Your Funds*): an internal finance tool for a small company (invoices, GST, approvals, cash flow) with a light gamification layer (XP, levels, streaks, quests, badges, scratch-card reward). It is a professional fintech app in the style of Slice / FamPay: vivid, animated, rewarding, but not childish.

Read these first, in order: `GOD_PROMPT.md` (rules), `PROGRESS.md` (what exists), `NEXT_STEPS.md` (plan), then `app/views.js`, `app/views2.js`, `app/app.css`, `app/fx.js`, `index.html`.

## Your role and boundaries
You own **the look, feel and UX** only.

**You may edit:** `index.html`, `app/app.css`, `app/fx.js`, `app/views.js`, `app/views2.js`, `public/*` (icons, images), `manifest.webmanifest`, `sw.js`, `lab.html` + `style.css` + `ui/*` (Practice Lab styling only).

**Do NOT edit** (owned by Ram / Masoom; ask them in `TODO.md` → "Requests between owners" instead):
`app/main.js` (state + actions), `app/repo.js`, `app/gamify.js`, `app/bank.js`, `app/recurring.js`, `app/reports.js`, `workspace/calc.js`, `core/*`, `agents/*`, `tax/*`, `ledger/*`, `db/*`, `ai/*`, `netlify/*`, `supabase/*`, `scripts/*`, `.env*`.

If a view needs data or an action that does not exist, **do not add it to `main.js`**. Write the view against the existing `S` (state) and `A` (actions) objects, and log the request in `TODO.md`.

## Ground rules
- Vanilla JS ES modules, no framework, no build step, no new dependencies.
- Build DOM with the `h()` helper from `app/util.js`. Never use `innerHTML` with data (only for static numeric SVG, as the ring/chart do). All user text goes in via text nodes.
- Respect permissions: use `S.can('write')` and `S.can('admin')` to hide actions. Never show a button a role cannot use.
- Keep the data contracts. Do not rename fields on `S`, rows or actions.
- Everything must work in **demo mode** (`Continue in demo mode`), which needs no keys. Test there.
- Style tokens live in `:root` of `app/app.css`. Reuse them. Add tokens; do not hard-code colours.
- Accessibility basics are required: visible focus rings, `aria-label` on icon-only buttons, colour is never the only signal, keyboard-operable dialogs.
- After every change run `node core/selfcheck.js` (must print `selfcheck OK`) and click through the pages in the browser with the console open: **zero console errors**.

## How to run
```bash
npx serve .          # http://localhost:3000  → "Continue in demo mode" → Settings → "Load sample data"
node core/selfcheck.js
```
Test as all three roles: Team & access → "Demo: switch role" (admin / finance / viewer).

## Tasks (do in this order; each has a "done when")

### 1. Design system pass (≈2 h)
- Introduce a small set of tokens: spacing scale, radius scale, shadow scale, 2 gradients (primary green, "reward" gold), type scale. Replace hard-coded values in `app/app.css`.
- Consistent components: `button` (primary / secondary / ghost / danger, sizes, loading state), `input`/`select` (focus, error state, helper text), `tag`/`pill`, `card`, `table` (sticky header, zebra on hover), `empty state`, `skeleton`.
- **Done when:** no page uses an ad-hoc colour or radius, and a one-page style reference at `#styleguide` (a new hidden view in `views2.js`) shows every component.

### 2. Navigation and layout (≈1.5 h)
- Sidebar: add simple inline-SVG icons for each item (no icon library), collapsible to icons-only on desktop, remembers state in `localStorage`.
- Mobile: the bottom bar must show the 5 most-used pages (Dashboard, Transactions, Approvals, Reports, More) with a "More" sheet for the rest. Safe-area padding for phones.
- Top bar: breadcrumb/page title, org name, role pill, level/XP, streak, sound toggle, user menu (sign out, settings).
- **Done when:** usable one-handed at 375 px width; no horizontal scroll on any page at 375, 768, 1280 px.

### 3. Dashboard polish (≈2 h)
- Skeleton loaders while data loads (first paint must never show empty cards).
- Business card hero: subtle tilt/shine on hover, masked GSTIN, copy-to-clipboard on click.
- Stories: add a progress bar and auto-advance on focus/hover pause; tap opens the target page.
- KPI tiles: sparkline (inline SVG from `S.sum.monthly`) under each number; up/down delta vs last month.
- Cash-flow chart: tooltips on hover/focus with month, income, spend, net; legend; accessible `<title>`/`<desc>`.
- **Done when:** the dashboard feels alive but does not janky-reflow when numbers count up.

### 4. Gamification feel (≈2 h)
- XP pop: a floating "+10 XP" near the cursor/element that earned it (CSS only), instead of only a toast.
- Level-up modal: full-screen celebration with the new level name, the next reward, and a share-style card (render with canvas, offer "Download image").
- Streak flame: animated, with a calendar strip of the last 14 days (filled = checked in).
- Rewards page: badge detail drawer (how to earn, progress bar toward it), locked badges show progress.
- Scratch card: add a subtle shimmer and a "tap to reveal" fallback button for keyboard users.
- Respect `prefers-reduced-motion`: disable confetti, tilt and shimmer.
- **Done when:** every XP-earning action has visible, immediate feedback, and reduced-motion users see none of the heavy animation.

### 5. Transactions and forms UX (≈2 h)
- Add-transaction dialog: sticky live preview of CGST/SGST/IGST and total as the user types; inline validation (GSTIN checksum, required fields, due date ≥ date); `Esc` closes, `Enter` submits.
- Table: sortable columns, column visibility menu, row hover actions, bulk "Mark paid" selection (call `A.markPaid(id)` per row), sticky header.
- Empty and error states with illustrations (inline SVG) and a clear next action.
- **Done when:** a new user can add an invoice in under 20 seconds on mobile.

### 6. Reports and print (≈1 h)
- Reports: add a simple bar+line combo (inline SVG) for monthly net profit; consistent table styling; the `@media print` view must be clean black-on-white, with the company name and date in the header.
- Invoice template (`app/invoice.js` is Masoom's, so only **request** layout changes in `TODO.md`).
- **Done when:** "Print / Save as PDF" on Reports produces a tidy one-page-per-section PDF.

### 7. PWA and performance (≈1 h)
- Add maskable icon + `screenshots` to `manifest.webmanifest`; test "Install app" in Chrome.
- `sw.js`: add an offline fallback page (`offline.html`) shown when a navigation fails.
- Lighthouse (mobile): Performance ≥ 85, Accessibility ≥ 95, PWA installable.
- **Done when:** Lighthouse screenshot saved to `docs/lighthouse.png`.

## Deliverables and handoff
- Small commits on branch `sumit/ui-phase-2`, one per numbered task. Message format: `ui: <task> — <what>`.
- After each task: tick it in `TODO.md`, add one line to the **Work Log**, and add any missing data/action you needed under **Requests between owners**.
- Do not merge to `main`; Ram merges at the next gate.
- At the end, post screenshots (desktop + 375 px) of: Dashboard, Transactions, Approvals, Reports, Rewards, level-up modal.

## Acceptance checklist (all must be true)
- [ ] `node core/selfcheck.js` prints `selfcheck OK`
- [ ] Zero console errors across all 11 pages, as admin, finance and viewer
- [ ] No horizontal scroll at 375 / 768 / 1280 px
- [ ] Keyboard-only: can add a transaction, mark paid, approve, and reach every nav item
- [ ] `prefers-reduced-motion` disables confetti, tilt, shimmer and count-up
- [ ] No new dependencies, no edits outside your files, no changes to `main.js` / `repo.js` / `supabase/*`
