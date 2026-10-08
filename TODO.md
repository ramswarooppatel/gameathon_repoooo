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
- (none yet) — format: `From→To: what / needed by H__`

## Bugs
- (none yet) — format: `B1 (reporter) steps → expected/actual → owner → status`

## Decision Log
- D1 (H0) Stack: vanilla JS + Canvas + 1 Netlify function; Groq via proxy only.
- D2 (H0) "Blockchain" = hash-chain + Merkle seals, optional testnet anchor; not a full chain.
- D3 (H0) AI never mutates state; deterministic engine decides.

## Work Log (append one line per session: `H__ · who/AI · task IDs · what changed · next`)
- H0 · plan created · — · GOD_PROMPT.md, TODO.md written · start P0.1
- H? · Claude · P0–P2 core · base scaffold built: engine, 4 agents, GST, ledger, UI shell, Supabase schema + client, Groq proxy; selfcheck green (crew 84 vs ghost 37). UI not yet browser-verified. Next: open in browser, fix visual bugs, Trust Dial polish, Fraud Boss minigame, Merkle seals, GST Day boss.
