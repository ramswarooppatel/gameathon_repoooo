# Sumit — Phase 4 prompt (paste into your AI assistant)

Context: product is **Mind Your Funds / Oxro Labs · Finance Desk**, a gamified finance manager for small businesses. Since your last merge, Ram added **grouped navigation** (`app/nav.js`), **Invoices** (GST invoice form, PDF, e-way bill, received invoices), a rebuilt **Add transaction** dialog, a **Compliance** page, a **Rewards store** with company-funded pool, and a bundled stylesheet. Your job now is the **look, feel and accessibility of those new screens**, then the leftovers from phase 3. Logic stays with Ram.

**Start here**
```bash
git checkout main && git pull
git checkout -b sumit/ui-phase-4
npx serve .                      # http://localhost:3000 → "Continue in demo mode" → Settings → "Load sample data"
npm run build:css                # REQUIRED after editing any app/*.css (the page loads app/bundle.min.css only)
node core/selfcheck.js           # selfcheck OK
python scripts/ui_smoke.py       # UI SMOKE OK
python scripts/invoice_test.py   # INVOICE OK
python scripts/txn_test.py       # TXN OK
python scripts/rewards_test.py   # REWARDS OK
python scripts/flow_test.py      # FLOW OK
```
Read `docs/ONBOARDING.md` (what everything is) and `docs/PITCH.md` (what the jury will see). If your `sumit/ui-phase-3` work is not merged yet, finish tasks 3 to 7 of `prompt-sumit-phase3.md` first (PWA, auth screens, empty states, Practice Lab, screenshots). Task 2 of that file (nav accuracy) is already done by `app/nav.js`; skip it.

## Boundaries
**You may edit:** all `app/*.css` (then `npm run build:css`), `index.html`, `app/views4.js` and `app/views5.js` **markup and classes only**, `app/views.js`/`views2.js`/`views3.js` presentation only, the `CSS` string and markup in `app/invoice.js`, layout numbers and colours in `app/pdf.js`, `public/*`, `manifest.webmanifest`, `sw.js`, `offline.html`, `lab.html`, `style.css`, `ui/*`, `docs/screens/*`, new `scripts/a11y_check.py`.
**Do not edit:** `app/main.js`, `app/repo.js`, `app/standards.js`, `app/gamify.js`, `tax/*`, `workspace/*`, `core/*`, `ledger/*`, `supabase/*`, `netlify/*`, and any `A.` action or `S.` data shape. Need a new action or field? Write the view against what exists and add a line under **Requests between owners** in `TODO.md`.
Style rules: sentence case, no emoji (icons from `app/icons.js` only), no new dependencies, every colour from a CSS token so light and dark both work.

## Tasks (in order; each has a "done when")

### 1. Design review of the new screens (≈2 h)
Open each at 375, 768, 1440 px in light and dark: Invoices (list, new-invoice form, Share, E-way and Review dialogs), Add transaction dialog (all four types), Compliance, Rewards (Progress, Rewards store, Who pays), sidebar and the phone More sheet. Fix hierarchy, spacing rhythm (use the `--sp-*` scale), alignment, truncated text, contrast, and anything that looks unfinished.
**Done when:** no horizontal scroll, body text contrast at least 4.5:1, every button and link at least 44 px tall on phone, and 24 before/after screenshots are in `docs/screens/p4/`.

### 2. Invoice form on a phone (≈2 h)
The line-item grid is a 760 px scrolling row. On widths under 640 px turn each line into a stacked card (description full width, then HSN, qty, unit, rate, discount, GST in a 2-column grid) with a clear remove button. Add a sticky bottom bar on phones with the total and the **Issue invoice** button. Put validation messages next to the field instead of only in a toast (classes only: you may add `.field-err` elements in the markup, and read the same `problems()` text).
**Done when:** a full invoice can be created on a 375 px screen with one thumb, and `python scripts/invoice_test.py` still prints `INVOICE OK` (it runs at desktop width).

### 3. Invoice document look: print view and PDF (≈2 h)
Improve typography, spacing and the totals block in `taxInvoiceHtml` (`app/invoice.js`) and the PDF layout constants in `app/pdf.js`. Keep every field. Keep PDF text in Latin-1 (rupee prints as "Rs.").
Check the PDF with `python -c "import pymupdf; d=pymupdf.open('x.pdf'); d[0].get_pixmap(dpi=80).save('x.png')"` (download one from the Invoices page).
**Done when:** a 1-line, a 30-line and a long-notes invoice all look clean on A4, nothing overlaps, and `node core/selfcheck.js` passes.

### 4. One dialog system (≈2 h)
Today there are `dialog.dlg`, `.overlay .modal`, `.wide-modal` and the entry dialog, each styled slightly differently. Unify: same radius, padding, header, footer and close button; Esc closes; focus moves in and returns to the opener; on widths under 640 px dialogs become full-width bottom sheets with a drag handle.
**Done when:** all dialogs share one set of classes, `python scripts/txn_test.py` and `python scripts/invoice_test.py` still pass.

### 5. Compliance and Rewards presentation (≈2 h)
- Compliance: the due-date table becomes cards on phones; add a small legend for the status chips; the standards list collapses per standard (use `<details>`), with the "Aligned, not certified" banner always visible at the top.
- Rewards store: reward cards with an icon, XP cost and a clear disabled reason; a visible pool gauge; friendly empty states for admins and members; a calm success moment (no sound) when a request is approved.
- Who pays: three equal columns with an icon each, readable at 375 px.
**Done when:** `python scripts/rewards_test.py` passes, and the three pages look finished at all widths.

### 6. First-run experience (≈1.5 h)
A new user should know what to do in 10 seconds. Style the **Get started** card (it lives on the Dashboard; also surface it at the top of Today until complete) as a numbered 6-step path with progress, the next step highlighted and a single primary button. Add three short "What is this?" popovers (health score, GST reserve, runway) using `<details>` or `popover` with plain-language text copied from `docs/PITCH.md`.
**Done when:** a fresh demo user lands on a screen with exactly one obvious next action.

### 7. Accessibility pass to WCAG 2.2 AA (≈2 h)
Create `scripts/a11y_check.py`: open every page as admin in light and dark, inject axe-core from `https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js` (test-time only, not shipped), print violations, exit non-zero on any serious or critical one. Fix what it finds. Also check by hand: focus is never hidden behind the sticky top bar or bottom bar, target size at least 24 px everywhere, visible focus ring on every control, dialogs are announced, reduced-motion respected, 200% zoom works.
**Done when:** `python scripts/a11y_check.py` prints `A11Y OK`.

### 8. Leftovers from phase 3, if still open (≈3 h)
Install prompt and `offline.html` (and add `app/nav.js`, `app/pdf.js`, `app/views4.js`, `app/views5.js`, `app/standards.js` to the `SHELL` list in `sw.js`); styled sign-in, workspace-setup and database-error screens; empty and loading states on all 16 pages; Practice Lab (`lab.html`) matched to the main app.

### 9. Demo assets for the jury (≈1.5 h)
Record a clean 90-second screen capture following the demo script in `docs/PITCH.md` (demo mode, sample data loaded, light theme, 1440 px). Save 12 sharp screenshots in `docs/screens/final/` (Today, Dashboard, New invoice, Invoice PDF, Add transaction, Transactions with an invoice link, Cash planner, Compliance, Audit trail, Rewards store, Who pays, phone More sheet). Do not alter data to flatter the numbers.

## Process
- Branch `sumit/ui-phase-4`; commit per task: `ui: <task> — <what>`; do not merge to `main` (Ram merges).
- After each task tick it in `TODO.md`, add one line to the **Work Log**, add needs under **Requests between owners**.
- Run all six checks above before every commit. Never commit `app/bundle.min.css` without running `npm run build:css` first, and always commit it together with the CSS source change.

## Acceptance checklist
- [ ] `selfcheck OK`, `UI SMOKE OK`, `INVOICE OK`, `TXN OK`, `REWARDS OK`, `FLOW OK`, `A11Y OK`
- [ ] No horizontal scroll at 375 / 768 / 1440 px on any page, in light and dark, for admin, finance and viewer
- [ ] Invoice can be created on a 375 px phone; PDF and print view look clean for short, long and multi-page invoices
- [ ] One consistent dialog system; bottom sheets on phones
- [ ] Compliance, Rewards store and Who pays finished at all widths
- [ ] First-run path has one obvious next action
- [ ] Offline page, install prompt, styled auth and error screens, Practice Lab aligned (if open from phase 3)
- [ ] 24 review screenshots in `docs/screens/p4/`, 12 final screenshots and a 90-second recording in `docs/screens/final/`
- [ ] No edits outside your files; no new runtime dependencies
