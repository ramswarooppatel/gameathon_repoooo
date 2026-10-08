# TODO.md — Mind Your Funds work board
> AI & humans: read this first, update it last. Format: `- [ ] ID (owner) task — done-when`. Owners: **R**am · **S**umit · **M**asoom.
> Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked. Priority tags: MUST / SHOULD / COULD.

**Clock:** H0 = ______ (fill real start time) · **Now:** H__ · **Next gate:** G1

## Phase 0 — Kickoff & contracts (H0–2)
- [x] P0.1 (R) MUST create repo, folders per GOD_PROMPT §3, `.gitignore`, `.env.example` — `npx serve .` shows blank page
- [x] P0.2 (R) MUST `core/state.js` types + factory, `core/bus.js`, `core/rng.js` (mulberry32) — selfcheck: same seed ⇒ same numbers
- [x] P0.3 (M) MUST `content/mocks.json` sample State + 5 Cards (late-pay, fraud, GST due, opportunity, payroll) — UI can load it
- [x] P0.4 (S) MUST `index.html` shell + `main.js` + `style.css` theme tokens — canvas + HUD placeholder render
- [x] P0.5 (all) MUST review/freeze contracts (GOD_PROMPT §5), agree art style — "FROZEN" noted in Decision Log
- [ ] **G1 (H2):** repo runs, bus logs fake event ✅/❌

## Phase 1 — Skeleton in parallel (H2–6)
**Ram**
- [x] P1.R1 MUST `core/engine.js` tick(day): advance day, settle invoices/bills, apply decisions, emit bus events
- [x] P1.R2 MUST `core/events.js` seeded wave generator + scripted Demo-90s hooks (late_pay, big_expense, fraud, opportunity)
- [x] P1.R3 MUST `agents/treasurer.js` runway + payroll warning card
- [x] P1.R4 MUST `tax/gst.js`: split CGST/SGST/IGST, GSTIN validate (regex + checksum), net payable — asserts from GOD_PROMPT §13
**Sumit**
- [~] P1.S1 (base done, polish later) MUST `ui/scene.js` canvas shop, health-driven glow/crack states (mock health)
- [x] P1.S2 MUST `ui/hud.js` Day, Cash, Runway, Health Heart, GST dues chip
- [x] P1.S3 MUST `ui/cards.js` card tray (approve/reject/edit, countdown) on mock cards
**Masoom**
- [x] P1.M1 MUST `ledger/blackbox.js` SHA-256 chain + `verifyChain()` + localStorage + export/import
- [x] P1.M2 MUST `ledger/why.js` template receipts per card type
- [~] P1.M3 MUST `content/scenarios/demo90.json` + `normal.json` v1 (event days, amounts, clients incl. GSTINs)
- [x] P1.M4 (as tax/config.js) MUST `tax/rates.json`, `tax/deadlines.json` (GOD_PROMPT §7), marked "verify with CA"
- [x] P1.M5 MUST `netlify/functions/groq.js` proxy (env key, timeout, rate limit) — curl returns a completion
- [ ] **G2 (H6) thin slice:** late-pay → card → approve → cash changes → ledger entry ✅/❌

## Phase 2 — Full features (H6–11)
**Ram**
- [x] P2.R1 MUST `agents/collector.js` lateRisk from client history, reminder / early-pay discount options
- [x] P2.R2 MUST `agents/sentinel.js` duplicate invoice, bank-acct change, odd amount/hour, bad GSTIN
- [x] P2.R3 MUST `core/ghost.js` crew-off twin, same seed, parallel tick
- [x] P2.R4 MUST `core/health.js` weighted score + reaction speed
- [x] P2.R5 MUST `tax/gstCalendar.js` filings queue, ITC, 3B net, late fee/interest, `gst_notice` event
- [x] P2.R6 SHOULD `agents/scout.js` affordability sim + missed-ITC finder
- [x] P2.R7 MUST `core/forecast.js` 30/60/90 runway incl. statutory dues
**Sumit**
- [ ] P2.S1 MUST wave animations (fraud shake, late-pay clock, expense drop), crew walk-to-problem
- [ ] P2.S2 SHOULD `ui/briefing.js` morning modal (top 3)
- [x] P2.S3 MUST `ui/ghostbar.js` twin vs you (hearts + ₹ gap)
- [x] P2.S4 MUST `ui/gstpanel.js` output/ITC/net payable + filing calendar
**Masoom**
- [ ] P2.M1 SHOULD `ledger/trust.js` Trust Dial rules (suggest/ask/auto≤cap) + undo-same-day
- [ ] P2.M2 SHOULD `minigames/fraud.js` + `content/fraud-pairs.json` (≥6 pairs)
- [ ] P2.M3 SHOULD `ai/groq.js` + `ai/prompts.js`: receipt wording, Ask-the-CFO, JSON-mode fraud variants with schema check + template fallback
- [ ] P2.M4 SHOULD `ledger/merkle.js` seal every 10 entries + inclusion proof
- [ ] **G3 (H11) feature complete:** full 90-day run on Demo-90s ✅/❌ · merge to main

## Phase 3 — Integration & juice (H11–15)
- [ ] P3.R1 (R) MUST wire agents→bus→ledger→UI end to end, fix contract mismatches
- [ ] P3.R2 (R) MUST balance numbers so a decent player wins Normal and a passive one loses (ghost loses)
- [ ] P3.S1 (S) MUST swap mocks for real state in all UI
- [ ] P3.S2 (S) COULD risk radar (14-day fog) + replay scrubber
- [ ] P3.S3 (S) COULD audio, confetti, difficulty selector, title/end screens
- [ ] P3.M1 (M) SHOULD **GST Day** boss minigame (reconcile registers, file 3B)
- [ ] P3.M2 (M) MUST playtest all 3 difficulties + demo; log bugs below
- [ ] P3.M3 (M) COULD ECDSA signing; on-chain anchor to Polygon Amoy testnet
- [ ] P3.M4 (M) MUST start slides + README + ARCHITECTURE.md

## Sleep rotation (always ≥2 awake) — fill real times
- [ ] Sumit sleep H15–17 · Masoom H16–18 · Ram H17–19

## 🧊 FEATURE FREEZE (H18) — no new features after this line

## Phase 4 — Hardening (H18–20)
- [ ] P4.1 (R) MUST deploy to Netlify with env vars; test Groq in prod
- [ ] P4.2 (R) MUST `node core/selfcheck.js` green
- [ ] P4.3 (S) MUST projector/mobile layout, keyboard use, no console errors
- [ ] P4.4 (M) MUST 5 full runs, zero crashes; verify tamper-detect demo works
- [ ] P4.5 (all) MUST fallbacks tested: Groq down → templates; offline → still playable

## Spare buffer (H20–21.5) — use only if behind, else rest

## Phase 5 — Pitch (H21.5–23)
- [ ] P5.1 (M) MUST 6-slide deck + Q&A card (GOD_PROMPT §15)
- [ ] P5.2 (R) MUST 90 s backup demo video + offline build on USB
- [ ] P5.3 (S) MUST title screen polish, final visual pass
- [ ] P5.4 (all) MUST rehearse pitch twice (timed 3:00)
- [ ] **SUBMIT (H23):** link, repo, video, README, slides ✅/❌
- [ ] Final buffer H23–24: typo fixes only

## Requests between owners
- [Ram → Sumit] **Payroll page is built and live at `#payroll`** (files: `app/views6.js`, `app/payslip.js`, `app/payroll.css`, all new and Ram-owned; `payroll.css` builds before your `ui4.css`). Please, as part of phase 4: (1) add Payroll to `NAV` in `app/nav.js`, group "Sell and spend", right after Transactions, role `write` (admin and finance only), label "Payroll", icon `users` or a new `payroll` icon in `icons.js`; `main.js` has a temporary `ensurePayrollNav()` shim that steps aside once `[data-v="payroll"]` exists, so no cleanup is needed on Ram's side. (2) Add Payroll to the command palette descriptions (`DESC.payroll = 'Employees, payslips, salary runs'`). (3) Review `views6.js` markup and `payroll.css` in your design pass (task 1 and task 7: contrast, targets, phone layout of the attendance table and the employee dialog). You may edit `views6.js`/`payslip.js`/`payroll.css` from now on for presentation only; Ram will not touch them again unless he posts here. Keep these names: tabs `Run payroll`, `Employees`, `History`, `Settings`; buttons `Submit for approval`, `Approve payroll`, `Mark salaries paid`, `All payslips (PDF)`, `Bank transfer file`, `PF ECR file`, `Save employee`, `Add your first employee`; classes `.pay-strip`, `.pay-ready .ring`, `.pay-sum`, `.wide-modal`, `.tax-preview-card`. `python scripts/payroll_test.py` must stay `PAYROLL OK`. (4) Payroll gamification is visible on the Rewards page automatically: three new badges (Payday, Payday Pro, Dues Cleared) come from `BADGES`.

- [Ram → Sumit] FYI Practice Lab coach (small, additive): Ram edited `ui/cards.js` and `lab.js`, added `ui/coach.js` (injects its own CSS, so `style.css` and `lab.html` were not touched). New elements you may restyle: `.story`, `.rec-why`, `.skill`, `.nothing`, `#impact.impact`, `#compare.compare`. Keep them and `python scripts/lab_test.py` (`LAB OK`) green. The impact panel's "Open lesson" link goes to `index.html#learn` and stores the lesson id in `localStorage['myf-suggest-lesson']`; if you want Learn to open or highlight that lesson, read that key in `views3.js` (`learn`) and clear it after use.

- [Ram → Sumit] FYI Practice Lab: a secondary `#prev` button ("Previous Day") is created by `lab.js` before `#next` in `.ctl`; restyle it if you like but keep the id and the label. `core/rng.js` gained `state()` and `setState()` for rewind.

## Bugs
- (none yet) — format: `B1 (reporter) steps → expected/actual → owner → status`

## Decision Log
- D1 (H0) Stack: vanilla JS + Canvas + 1 Netlify function; Groq via proxy only.
- D2 (H0) "Blockchain" = hash-chain + Merkle seals, optional testnet anchor; not a full chain.
- D3 (H0) AI never mutates state; deterministic engine decides.

## Work Log (append one line per session: `H__ · who/AI · task IDs · what changed · next`)
- H0 · plan created · — · GOD_PROMPT.md, TODO.md written · start P0.1
- H? · Claude · P0–P2 core · base scaffold built: engine, 4 agents, GST, ledger, UI shell, Supabase schema + client, Groq proxy; selfcheck green (crew 84 vs ghost 37). UI not yet browser-verified. Next: open in browser, fix visual bugs, Trust Dial polish, Fraud Boss minigame, Merkle seals, GST Day boss.
- H? · Sumit (UI) · Task 1 & 2 · Design system tokens & #styleguide, collapsible desktop sidebar with localStorage persistence & inline SVGs, mobile bottom nav (5 tabs) + slide-up sheet drawer for extra views, safe-area insets, polished top bar (breadcrumbs, role badge, streak, XP bar, sound toggle). Passed selfcheck. · next: Task 3 / Views polish.
- H? · Sumit (UI) · Task 3 (Dashboard Polish) · Added 3D tilt on .bizcard with reduced-motion guard, masked GSTIN with click-to-copy toast, auto-advancing stories carousel with progress timer and hover/focus pause, inline SVG sparklines with delta badges for KPI cards, and interactive Cash Flow chart tooltips with month net breakdown and accessible legend. Passed selfcheck. · next: Task 4.
- H? · Sumit (UI) · Task 4 (Gamification Feel) · Implemented floating XP pops on XP-gain events, full-screen Level-Up celebration modal with dynamic HTML5 canvas share card download (canvas.toDataURL), animated streak flame with interactive 14-day calendar history strip in rewards view, clickable badge detail drawer/modal with unlock criteria and progress bar, scratch card foil shimmer polish with accessible keyboard/touch "Tap to reveal" fallback, and strict @media (prefers-reduced-motion: reduce) enforcement across particles, shimmer, and floating animations. Passed selfcheck OK. · next: Task 5.
- H? · Sumit (UI) · Task 5 (Transactions & Forms UX) · Upgraded Add Transaction dialog with sticky live tax preview (CGST/SGST vs IGST split + grand total), mod-36 GSTIN validation feedback, date coherence checks, and Escape/Enter keyboard ergonomics. Upgraded Transactions table with sortable columns, client-side column visibility toggle dropdown, quick action hover buttons (Mark Paid, Remind, Invoice, Delete), floating bulk action bar with multi-row mark paid, sticky table header, and illustrated empty state. Passed selfcheck OK. · next: Task 6.
- H? · Sumit (UI) · Fix (Transactions Toolbar Collision) · Replaced `.row.bar` with `.row.tx-toolbar` to prevent CSS collision with `.bar` (progress bar 6px height collapse), adding explicit `.tx-toolbar` flex layout and input heights. Passed selfcheck OK. · next: Task 6.
- H? · Sumit (UI) · Task 6 (Reports & Print UX) · Implemented Monthly Net Profit Bar + Line combo chart (income/spend vertical bars with connected net profit polyline trend and dots), enhanced P&L and aging table typography with sticky headers, added print-only business header (name, GSTIN, generation date), set A4 portrait 15mm page margins, and styled high-contrast @media print output with zero dark background artifacts. Passed selfcheck OK.
- H? · Sumit (UI) · Task 7 (PWA, Offline Shell & Performance) · Upgraded manifest.webmanifest with complete metadata, maskable icons, and desktop/mobile screenshot definitions. Created standalone offline.html fallback shell with retry actions, upgraded sw.js with precaching and navigation fallback, added apple-touch-icon and theme meta tags to index.html with CLS image sizing. Passed selfcheck OK.
- H? · Sumit (UI) · Phase 3 — Task 1 (Fix 375px Horizontal Overflow) · Added scripts/ui_smoke.py with Playwright headless multi-viewport/multi-role sweep; hardened app.css with max-width: 100vw, overflow-x containment, and min-width: 0 across cards, grid2/grid3, bizcard, and top bar for screens <= 480px. Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK). · next: Task 2 (Top Bar & Nav Accuracy).
- H? · Sumit (UI) · Phase 3 — Task 2 (Top Bar & Nav Accuracy) · Wired MutationObserver on #who in index.html to sync #role-pill variants and dynamically filter [data-role="admin"] nav items on both desktop sidebar and mobile drawer; synchronized sound toggle label with localStorage['myf-mute'] and dynamically bound breadcrumb org name from #org. Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK). · next: Task 3 (PWA, Speed & Offline Shell).
- H? · Sumit (UI) · Phase 3 — Task 3 (PWA, Speed & Offline Shell) · Generated 4 real screenshot assets (2 wide desktop + 2 narrow mobile) in public/, updated manifest.webmanifest with screenshot metadata and maskable icons, updated sw.js to precache offline.html and serve as navigation fallback, and captured mobile lighthouse audit to docs/lighthouse.png. Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK). · next: Task 4 (Auth & Setup Modal Styling).
- H? · Sumit (UI) · Phase 3 — Task 4 (Sign-In, Setup & Error Screens) · Styled auth sign-in modal, workspace setup modal, and database error screens with high-contrast Slice/FamPay fintech tokens; added loading spinner state (.is-loading), demo mode continue styling with explanatory notes, and responsive mobile padding down to 375px. Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK). · next: Task 5 (Empty & Loading States).
- H? · Sumit (UI) · Phase 3 — Task 5 (Empty, Loading & Error States) · Standardized inline SVG empty states across all 11 views (Dashboard alerts & upcoming, Transactions, Parties, Approvals, Compliance filing calendar, Reports aging & top parties, Audit trail, and Rewards leaderboard) with actionable primary buttons. Added CSS skeleton card & table placeholders and wired persistent demo mode notice banner ("Demo data lives only in this browser · Sign in to sync"). Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK). · next: Task 6 (Practice Lab Alignment).
- H? · Sumit (UI) · Phase 3 — Task 6 (Practice Lab Alignment) · Aligned style.css with Oxro Labs core design tokens (--bg, --card, --line, --acc, --acc2, --warn, --bad, Inter font, custom focus rings, and glowing primary buttons); upgraded lab.html with a sleek header containing a prominent "← Finance Desk" back link, branding logo, and practice lab badge; optimized canvas and mobile layout rules down to 375px with zero horizontal clipping. Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK).
- H? · Sumit (UI) · Phase 3 — Task 7 (Final Polish & 14 Screen Captures) · Verified :focus-visible rings and interactive states across all buttons/inputs/drawers; cleaned navigation by hiding #styleguide from public menus while keeping route active; refined streak strip horizontal scrolling and level-up share card modal styling; automated and generated all 14 handoff screenshots (7 desktop at 1440px + 7 mobile at 375px) in docs/screens/ for pitch presentation. Passed selfcheck OK and python scripts/ui_smoke.py (UI SMOKE OK).











