# Sumit — Phase 4 prompt (paste the whole file into your AI assistant)

> **Mission:** make the screens Ram added since your last merge look and feel as finished as the rest of the app, prove they are accessible, and produce the demo assets for the jury. **You own presentation. Ram owns logic.** Every task below says what to change, how to check it, and what usually goes wrong.

## 0. Context in two minutes

**Product:** *Mind Your Funds* / *Oxro Labs · Finance Desk*. A gamified finance manager for small Indian businesses: invoices, GST, approvals, cash planner, compliance, rewards. Vanilla JS ES modules, no framework, no build step except one CSS bundle. Data is in Supabase in cloud mode and in the browser in demo mode (this is what you use).

**Your phase 3 is merged.** Ram merged `origin/sumit/ui-phase-3` into `main` (merge commit `754f9d7`). It brought in your offline page, manifest and screenshots, auth/empty/loading states, demo-mode banner, Practice Lab restyle and the 14 screenshots. Conflicts were resolved like this, so know what changed under you:
- `index.html`: kept the new head (bundled CSS, early theme script) and your meta tags; the sidebar, phone tab bar and More sheet are now **empty containers filled by `app/nav.js`**, so the hard-coded nav markup you wrote is gone. Your inline script (breadcrumb, demo banner observer, role-pill observer) is still there.
- `app/app.css`: your +310 lines were applied on top of `main`.
- `sw.js`: kept the stale-while-revalidate worker and added your offline fallback and precache of `offline.html`, `manifest.webmanifest`, the icons.
- `app/views2.js`: kept your empty states, but the `✕` glyph became `icon('x')` (no glyphs or emoji in the app).
- `lab.html`: kept your restyle with the small logo (`public/logo-64.png`) and no `▸` glyph.
- `scripts/ui_smoke.py`: Ram's version (it covers 16 pages x 3 roles x 2 themes x 3 widths plus static pages) replaced yours.

**What is new since your `sumit/ui-phase-2` merge**

| Feature | Where it lives | What you will see |
|---|---|---|
| Grouped navigation | `app/nav.js` renders the sidebar, the phone tab bar and the "More" sheet from one list | Sidebar groups with small headings; phone bar = Today, Invoices, Transactions, Approvals, More |
| Invoices page | `app/views4.js` (`invoices`, `form`, `shareDialog`, `ewayDialog`, `reviewDialog`, `catalog`) | New invoice form, list, Share / E-way / Review dialogs, Items tab, Received tab |
| Invoice documents | `app/invoice.js` (`taxInvoiceHtml`, print view), `app/pdf.js` (`invoicePdf`, the PDF) | Print window and the downloaded PDF |
| Add transaction dialog | `entryDialog` in `app/views.js` | Type picker, GST-included toggle, live summary, "Save and add another" |
| Compliance page | `app/views5.js` (`standards`) + data in `app/standards.js` | Readiness ring, due-date table, standards list |
| Rewards store | `app/views5.js` (`rewardsPage`, `store`, `funding`) | Tabs Progress / Rewards store / Who pays |
| Settings additions | `invoiceSettingsCard` in `views4.js` | "Invoice details" card |
| Styles for all of the above | `app/workflow.css`, `app/apple.css` | See the CSS rules below |

16 pages total now: today, dashboard, invoices, transactions, parties, approvals, planner, compliance (GST returns), standards (Compliance), reports, insights, learn, rewards, audit, team, settings.

## 1. Setup and the five checks

```bash
git checkout main && git pull
git checkout -b sumit/ui-phase-4
npx serve .        # http://localhost:3000 → "Continue in demo mode" → Settings → "Load sample data"
```
Run these before **every** commit (Ram maintains the test scripts; you only run them) (all must pass; each prints its own OK line):
```bash
node core/selfcheck.js            # selfcheck OK
python scripts/ui_smoke.py        # UI SMOKE OK   (16 pages x 3 roles x light/dark x 375/768/1440, ~4 min)
python scripts/flow_test.py       # FLOW OK
python scripts/invoice_test.py    # INVOICE OK
python scripts/txn_test.py        # TXN OK
python scripts/rewards_test.py    # REWARDS OK
```
Needs `pip install playwright` and Microsoft Edge (tests use `channel='msedge'`). They run in demo mode.

## 2. Ground rules

### Ownership contract (this is what keeps you and Ram from colliding)

Phase 4 runs in parallel. To make merge conflicts impossible, **every file has exactly one owner for the whole phase**. Never edit a file you do not own; ask instead.

| Owner | Files |
|---|---|
| **Sumit (you)** | **All CSS:** `app/app.css`, `components.css`, `theme.css`, `workflow.css`, `apple.css`, new **`app/ui4.css`** (built last, put new rules here), and the generated `app/bundle.min.css`. **All views:** `app/views.js`, `views2.js`, `views3.js`, `views4.js`, `views5.js` (markup, class names, ARIA, copy, layout only). **Chrome:** `index.html`, `app/nav.js`, `app/palette.js` (markup and copy only), `app/icons.js`, `app/extras.js` (presentation only), `app/fx.js`. **Documents:** `app/invoice.js` (print view), layout constants of `app/pdf.js`. **Shell and assets:** `sw.js`, `offline.html`, `manifest.webmanifest`, `lab.html`, `style.css`, `ui/*`, `public/*`, `docs/screens/**`, new `scripts/a11y_check.py`, `scripts/capture_screens.py`. |
| **Ram** | `app/main.js`, `app/repo.js`, `app/standards.js`, `app/gamify.js`, `app/lessons.js`, `app/bank.js`, `app/recurring.js`, `app/reports.js`, `app/util.js`, `tax/*`, `workspace/*`, `core/*`, `agents/*`, `ledger/*`, `db/*`, `ai/*`, `netlify/*`, `supabase/**`, `scripts/*_test.py`, `scripts/ui_smoke.py`, `scripts/build_css.py`, `scripts/gen_*.py`, `config.js`, `package.json`, `PROGRESS.md`, `NEXT_STEPS.md`, `docs/*.md` except yours. Ram will **not** touch any file in your row: no CSS, no view, no `index.html`. |
| **Shared, append-only** | `TODO.md`: add Work Log lines at the bottom and requests under **Requests between owners**. Never rewrite someone else's lines. |

**Contracts you must not change (Ram's tests and logic read them):** the `A.*` action names and arguments, the `S.*` state shape, the placeholders, button names, roles and class names the tests use (`Customer name`, `15-character GSTIN, blank if unregistered`, `Address`, `Pincode`, `Continue in demo mode`, `+ Add transaction`, `New invoice`, `Create invoice`, `Save and add another`, `Download PDF`/`PDF`, `Entries`, `E-way`, `Share`, `Paid`, `Rewards store`, `Who pays`, `Save pool`, `Approve`, `Decline`, `Mark delivered`, `.inv-form`, `.inv-row`, `.inv-totals`, `.wide-modal`, `.entry-dialog-modal`, `.type-btn`, `.chips-seg`, `.callout`, `.tax-preview-card`, `.lesson`, `.chk-row`, `.std-row`, `.nav-group`, `.drawer-sec`, `.drawer-item`, `.mb-tab`, `#mb-more-btn`, `#top-page-name`, `#desktop-nav a`, `.tx-row`, `button.linklike`, `.del-btn`). If a redesign needs one renamed, add the new name **and keep the old one** on the element.

**Requests:** need a new action, a new field, a bug fixed in logic, or a data shape changed? Do not touch Ram's files. Append under **Requests between owners** in `TODO.md`: `- [Sumit → Ram] <screen> needs <what> because <why> (<date>)`. Build the view against what exists, behind a feature check (`typeof A.x === 'function'`), and continue. Ram answers by adding it and ticking the line; then you wire it.
**What Ram is doing in parallel (do not build UI for these until a request arrives from Ram):** ledger v2 with signed entries and published hashes, server-side XP, paging and date filters for large companies, applying and testing the Supabase migrations, real reminder sending. When one lands Ram will append `- [Ram → Sumit] <screen> now has <field/action>` so you can add its UI.

**Style rules:** sentence case; no emoji or glyph icons anywhere (icons only, from `app/icons.js`; add a new icon there if truly needed); no new runtime dependencies; every colour from a token so light and dark both work.

### CSS architecture (read before touching CSS)
- The page loads **only `app/bundle.min.css`**. It is built by `python scripts/build_css.py` (`npm run build:css`) from, in this order: `app.css`, `components.css`, `theme-light.generated.css`, `theme.css`, `workflow.css`, `apple.css`, `ui4.css`. **Later files win.** Change an existing rule in place in the file that owns it; put every **new** rule or override in `ui4.css`.
- `theme-light.generated.css` is generated by `scripts/gen_light_theme.py`. Never edit it by hand.
- If you edit CSS and the browser does not change, you forgot to rebuild, or the service worker served the old bundle (hard reload or DevTools > Application > Update on reload).
- Commit the CSS source **and** `app/bundle.min.css` together.

### Tokens (use these, never raw hex)
Spacing `--sp-1..10` = 4, 8, 12, 16, 20, 24, 32 (`-8`), 40 (`-10`) px. Radius `--r-xs/sm/md/lg/xl/2xl` = 4, 6, 10, 14, 18, 24 px, `--r-full` for pills. Type `--fs-xs/sm/base/md/lg/xl/2xl` = 11, 12, 14.5, 16, 18, 22, 32 px. Colour: `--bg --bg2 --card --card-subtle --card-hover --line --line-subtle --tx --tx-title --mu --acc --acc2 --acc-glow --on-acc --warn --warn-bg --bad --bad-bg --info --info-bg`. Shadows `--sh-sm/md/lg/xl`. Glass `--glass`, overlay `--scrim`. Light and dark values are defined at the top of `apple.css`.
**Known smell to fix (yours now):** `workflow.css` has a few hard-coded colours (for example `#04150d` for text on green, in `.chk-row i.ok` and `.wf-step.is-done .wf-n`). Replace them with `var(--on-acc)`.

### Breakpoints used by the app
375 (phone target), 480, 520 (forms stack), 640 (dialogs become sheets), 768 (tablet), 860 (sidebar becomes tab bar), 900 (two-column grids collapse), 1000, 1100 (top bar compacts), 1440 (desktop target). Do not add new ones unless one of these cannot work.

### Things that already bit us once (do not repeat)
1. **Grid blowout:** a grid child without `min-width: 0` stretches the page. Every new grid child gets `min-width: 0`; use `minmax(0, 1fr)`.
2. **Replacing a button while it is being clicked:** if a `change`/`blur` handler re-renders a control group, the click that caused the blur lands on a new node and is lost. Never rebuild controls from a blur handler; toggle classes and attributes in place (see `pick()` in `entryDialog`).
3. **The `hidden` attribute loses to `display:`**. `workflow.css` has a global `[hidden]{display:none!important}`; keep it.
4. **Global pill buttons.** `apple.css` makes every `button` pill-shaped. Use an explicit `border-radius` for cards-as-buttons (see `.type-btn`).
5. **The `h()` helper** (`app/util.js`): text children are always text nodes (no HTML injection); keys starting `aria-`/`data-` and `role`, `tabindex`, `list`, `for`, `style` become attributes, everything else becomes a DOM property. `undefined/null/false` props are skipped. Never use `innerHTML` with data.
6. **Toasts and the storage notice overlap fixed UI.** Test with them visible.
7. **Money and dates:** never reformat numbers in the view; use `inr()` or the existing formatters.

---

## Task 1 — Design review of every new screen (≈3 h)

**Goal:** find and fix everything that looks unfinished, before polishing individual flows.

**Method (do this literally):**
1. Open each screen below in light and dark at 375, 768 and 1440 px (9 views each). Use `resize_window` presets or DevTools device toolbar.
2. For each view write down defects in a table: *screen, width, theme, defect, fix*. Keep it in `docs/screens/p4/REVIEW.md`.
3. Fix, rebuild CSS, re-screenshot. Save `before-` and `after-` PNGs named `p4/<screen>-<width>-<theme>-before|after.png`.

**Screens:** Invoices list (empty, with rows), New invoice form, Share dialog, E-way dialog, Review dialog (open it by importing a file from `Invoices > Received`), Items tab, Settings > Invoice details, Add transaction dialog (each of Sale, Purchase, Expense, Payroll), Transactions table with an invoice-linked row, Compliance page, Rewards (three tabs), the sidebar expanded and collapsed, the phone tab bar and More sheet.

**Checklist per screen:**
- Vertical rhythm uses the `--sp-*` scale; cards are separated by `--sp-4`; a card's content padding is consistent.
- One primary button per view; secondary buttons are visually quieter; destructive actions are not primary.
- Headings: page title (22 to 32 px), card title (16 to 18 px), label (12 to 13 px, `--mu`). No heading skips a level in the DOM (`h2` page, `h3` cards, `h4` groups).
- Text never truncates without a `title` or an ellipsis rule; long party names wrap or ellipsise, never push the layout.
- Numbers are right-aligned in tables and use tabular figures (`font-variant-numeric: tabular-nums`).
- Disabled controls look disabled and say why (tooltip text or helper line).
- Contrast: body text at least 4.5:1, large text and UI borders at least 3:1, in both themes. Check `--mu` text on `--card-subtle`, chip text on tinted chip backgrounds, and white-on-green buttons in light mode.
- Touch targets at least 44 x 44 px on phones (24 x 24 px is the WCAG 2.2 minimum, 44 is our bar).

**Done when:** `REVIEW.md` has no open rows, 24 `p4/*-after.png` exist, no horizontal scroll at any width (`python scripts/ui_smoke.py`).

---

## Task 2 — Invoice form on a phone (≈3 h)

**Files:** `app/views4.js` (`form`, `drawLines`), `app/workflow.css` (`.inv-*`) and `app/ui4.css`.

**Problem:** `.inv-row` is an 8-column grid with `min-width: 760px`, so on a phone the user scrolls sideways inside a card.

**Spec:**
1. Under 640 px, each line item becomes a card: description full width, then a 2-column grid of HSN/SAC, Quantity, Unit, Rate, Discount %, GST %. Put a labelled remove button top-right of the card (min 44 px). Hide the `.inv-head` header row.
2. Every input in a line card needs a visible label on phones (you may add `<label>` wrappers or `aria-label` + a small visible caption; keep the existing `aria-label`s because tests rely on placeholders and labels).
3. Add a **sticky bottom bar** on phones containing: grand total (from the same summary text, do not recompute), and the **Issue invoice** primary button, above the tab bar and safe-area inset. Draft saving stays in the top bar. The bar must not cover the last form fields: add bottom padding to the form equal to the bar height.
4. Validation: today `problems()` text appears only in a toast. Add an inline error element under the field it refers to for: customer name, GSTIN, invoice number, due date, each line's description, quantity, rate, HSN. You may add `.field-err` nodes in `views4.js` markup that are filled by the **same** validation messages (`problems()` text is the source; do not change its wording or logic; if you need the field mapping, ask via a TODO request or derive it from the line index in the message).
5. Keyboard order: Tab goes customer, GSTIN, pincode, address, then lines in reading order, then notes, then buttons. Enter in a line's last input adds a new line (already built, keep it).
6. Keep the desktop layout unchanged except spacing fixes.

**Edge cases:** 1 line and 30 lines; very long description (300 characters); IGST vs CGST+SGST summary; Bill of supply (no GST column); empty customer.

**Verify:** at 375 px create and issue an invoice using only taps and the on-screen keyboard (use DevTools touch emulation). Then `python scripts/invoice_test.py` must still say `INVOICE OK` (it runs at 1440 px and uses placeholders such as `Customer name`, `15-character GSTIN, blank if unregistered`, `Address`, `Pincode`; do not rename them).

**Done when:** no sideways scroll inside the form at 375 px, sticky bar works, inline errors show, test passes.

---

## Task 3 — Invoice documents: print view and PDF (≈3 h)

**Files:** `app/invoice.js` (`CSS` constant and `taxInvoiceHtml`), `app/pdf.js` (`invoicePdf` layout constants: margins `M`, column widths `cols`, font sizes, colours `GREY`, `HEAD`).

**Rules for the PDF:** it is written by hand with the built-in Helvetica fonts. Text must stay Latin-1, so the rupee sign prints as "Rs." (do not try to embed fonts). Do not change `textWidth`, `wrap`, `Pdf` class or the byte assembly. You may change positions, sizes, spacing, colours and what is bold.

**Spec:**
1. Visual hierarchy: seller name and document title at the top, document number and dates aligned right; a clear Bill to / Supply details pair; items table with zebra or hairline rows; totals block right-aligned with the grand total emphasised; amount in words; pay-to and notes; signature area.
2. Table: description column gets the most width; numbers right-aligned; the header row repeats on each page; a row never splits across pages; the totals and signature are never orphaned alone on a page (use the existing `y > H - ...` guards).
3. Print view (`taxInvoiceHtml`): matches the PDF structure; `@page` A4 with 14 mm margin; `Print / Save as PDF` button hidden when printing; text colours print well in black and white; background colours do not rely on "print backgrounds".
4. Both: show **CANCELLED** diagonally or as a clear stamp for cancelled invoices, **PAID** stamp for paid ones; do not hide any legal field (supplier GSTIN, buyer GSTIN or "Unregistered", place of supply, reverse charge, HSN/SAC, rate, tax by head, e-way bill number when present).

**Test data to try (create each in demo mode, then Download PDF and open the print view):**
- 1 line, intra-state (CGST+SGST)
- 3 lines at 3 GST rates, inter-state (IGST), with discount
- 30 lines (multi-page)
- Bill of supply (no tax)
- very long customer name and address, 400-character notes with line breaks
- cancelled and paid

**How to check a PDF:** `pip install pymupdf`, then
```python
import pymupdf
d = pymupdf.open("Invoice-XXXX.pdf")
for i, p in enumerate(d): p.get_pixmap(dpi=90).save(f"page{i}.png")
print(d[0].get_text())
```
Look for overlapping text, clipped numbers, `?` characters where text was lost, and totals that do not match the screen.

**Done when:** all seven samples look clean on A4 in the print view and the PDF, `node core/selfcheck.js` passes (it asserts the PDF structure), and 7 sample PDFs' page-1 PNGs are saved in `docs/screens/p4/pdf/`.

---

## Task 4 — One dialog system (≈3 h)

**Why:** the app currently has four dialog looks: native `<dialog class="dlg">` (entry dialog, import dialog, badge/level), `.overlay > .modal` (auth, lessons, `dialog()` helper in `views4.js` used by Share, E-way, Review and the shortcuts help), and `.wide-modal`.

**Spec:**
1. One visual spec for all: radius `--r-2xl`, padding `--sp-6` (`--sp-4` on phones), header row with title left and a 44 px close button right, scroll inside the body not the page, footer actions right-aligned, sticky footer when content scrolls, backdrop `--scrim` with a light blur.
2. Behaviour: Esc closes; clicking the backdrop closes (except during an unsaved entry form: ask or ignore); focus moves into the dialog on open and **returns to the opener on close**; Tab never leaves the dialog (native `<dialog>.showModal()` already does this; for `.overlay` dialogs add a small trap in the shared helper); `aria-modal`, `aria-labelledby` pointing at the title.
3. Under 640 px every dialog becomes a **bottom sheet**: full width, rounded top corners, max-height 92 vh, a small drag handle bar at the top (visual only), slides up in 200 ms (respect `prefers-reduced-motion`).
4. Keep every existing class and placeholder that the tests use: `dialog.entry-dialog-modal`, `.wide-modal`, `.callout`, `.type-btn`, `.chips-seg`, `.tax-preview-card`, `.lesson`.
5. Entry dialog only: keep the sticky footer and the two-column layout on desktop (form left, summary right); on phones the summary collapses into a compact bar above the footer showing the total, tap to expand the full breakdown.

**Verify:** keyboard-only walkthrough of every dialog (open with keyboard, Tab through everything, Esc, focus lands back on the button). Then `python scripts/txn_test.py` and `python scripts/invoice_test.py`.

**Done when:** all dialogs share the same classes and look, sheets work at 375 px, both tests pass.

---

## Task 5 — Compliance, Rewards and "Who pays" presentation (≈3 h)

**Files:** `app/views5.js` (markup/classes only), `app/workflow.css`.

**Compliance page**
1. Keep the **"Aligned, not certified"** banner at the very top, always visible, never collapsible.
2. Readiness card: the ring uses `--acc` on `--line`; at under 400 px the ring sits above the checklist. Each check row has a clear icon state (done / not done), the fix hint, and a "Fix" button that is at least 44 px tall.
3. "Due this month and last month": at 640 px and below, turn the table into cards (duty, applies to, due date, status chip, a large checkbox). Add a one-line legend: Done, Due soon (within 7 days), Overdue, Upcoming.
4. Standards list: wrap each standard in `<details>` (first one open on desktop, all closed on phones), summary shows the standard name, area and a count like "4 built in, 1 your action". Chip colours: Built in = green tint, Your action = amber tint, Planned = neutral, Not applicable = blue tint; each chip also has text, never colour alone.
5. Evidence pack and "Re-check integrity" buttons stay together on one row, wrap on phones.

**Rewards store**
1. Reward cards: icon in a tinted circle, name, one-line description, XP cost chip, and (for admins) a "Company pays ₹X" chip. The button states are **Redeem**, **N XP to go**, **Pool used up this month**, **Paused**; the disabled ones show the reason in the button text (already so) and also as a helper line for screen readers.
2. Pool gauge: a labelled bar with "₹used of ₹pool" and what is left; colour shifts to `--warn` over 80% and `--bad` at 100%.
3. Empty states: admin sees "Add your first reward" with the quick-add buttons prominent; a member sees "Your admin has not added rewards yet".
4. After an admin approves or marks delivered, show a calm toast (no confetti, no sound). The request list shows status chips with icons.
5. Requests lists: member's own requests on top for members; admins see "Requests to decide" first with the oldest at the top.

**Who pays**
Three equal columns (stack under 900 px), each with an icon, a heading, a status chip (Free, Your company pays, Sponsor pays), and two short lines. The pool calculator shows three big numbers in one row (stack on phones). The safeguards list uses real list semantics.

**Verify:** `python scripts/rewards_test.py` stays green (it uses `role=tab` names `Rewards store` and `Who pays`, `.lesson` cards, the buttons `Save pool`, `Approve`, `Decline`, `Mark delivered`, and chips `Your company pays`).

**Done when:** three pages look finished at 375, 768, 1440 in both themes and the test passes.

---

## Task 6 — First-run experience (≈2 h)

**Goal:** a brand-new user sees exactly one obvious next action within 10 seconds.

**Files:** `onboarding()` in `app/views.js` (Dashboard "Get started" card), `app/views3.js` (`workflow`, the Today page), CSS.

1. The Get started card has 6 steps: company and GSTIN, invoice details, first invoice, record a bill or expense, monthly goal, first GST return. Present it as a vertical stepper: numbered circles joined by a line, done steps show a check, the **first incomplete step** is expanded with its description and **one primary button**; later steps are muted.
2. Show the same card at the top of **Today** until all steps are done. You own `views.js` and `views3.js`, so export `onboarding` from `views.js` and call it from the Today view; do not change the step conditions (they read `S.profile`, `S.invoices`, `S.entries`, `S.filings`).
3. Three "What is this?" explainers, each a `<details>` or a `popover` attached to an info icon button (44 px target, `aria-label`): **Health score**, **GST reserve**, **Runway**. Copy the wording from `docs/PITCH.md` ("How the insights are generated"); keep each under 40 words and in plain language.
4. Empty states for brand-new accounts: Dashboard, Transactions, Invoices, Parties, Approvals, Reports. Each has an icon, one sentence on why it is empty and a single button to the first action.

**Verify:** clear site data, open demo mode: Today shows the stepper with step 1 highlighted and no other competing primary button above the fold at 375 px.

**Done when:** a screenshot of a fresh account at 375 and 1440 px shows one clear primary action; all empty states exist.

---

## Task 7 — Accessibility to WCAG 2.2 AA (≈3 h)

**New file:** `scripts/a11y_check.py`.

1. Use Playwright (Edge) to open every page as admin, in light and dark at 1440 and 375 px. Inject axe-core at test time from `https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js` (not shipped to users, not in `package.json`). Run `axe.run()` with tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`. Print each violation as `page | theme | width | rule | impact | selector`. Exit non-zero on any **serious** or **critical**; print `A11Y OK` otherwise. Also open the Add transaction dialog, the invoice form and the Share dialog and run axe on them.
2. Fix everything it finds. Typical issues to expect: low contrast of `--mu` text on tinted backgrounds, missing accessible names on icon buttons, inputs without labels, `aria-selected`/`aria-pressed` used together incorrectly on tabs (tabs should use `aria-selected` only, with `role=tab`/`tablist`/`tabpanel`; keep the test-visible `role=tab` names), duplicate ids, heading order, `aria-current` on nav.
3. Manual WCAG 2.2 checks (write a checklist in `docs/screens/p4/A11Y.md` with pass/fail and screenshot proof):
   - **2.4.11 Focus not obscured:** tab through each page; a focused element must never be hidden behind the sticky top bar, the phone tab bar or the new sticky invoice bar. Use `scroll-margin-top`/`scroll-padding-bottom`.
   - **2.5.8 Target size:** every interactive element at least 24 x 24 px; our bar is 44 on phones.
   - **3.2.6 Consistent help:** help/support link in the same place on all pages (footer already has legal links; add a "Keyboard shortcuts (?)" link there that triggers the same shortcuts help).
   - **1.4.10 Reflow:** at 320 px width and at 400% zoom there is no two-direction scrolling.
   - **1.4.12 Text spacing:** inject `line-height:1.5; letter-spacing:.12em; word-spacing:.16em` and confirm nothing is clipped.
   - **2.3.3 / prefers-reduced-motion:** all animations stop.
   - **Screen reader smoke test** (NVDA on Windows or VoiceOver): sign in, open Today, create an invoice, hear field names and errors, close a dialog and hear where focus returns. Note anything confusing.
4. High-contrast and text-size options in Settings > Appearance must still work on the new screens (check at the largest text size).

**Done when:** `python scripts/a11y_check.py` prints `A11Y OK`; `A11Y.md` has no failing rows.

---

## Task 8 — Make merged phase 3 and the new UI agree (≈3 h)

Your phase 3 was built against the old navigation and old pages; Ram's merge kept both, so some things now overlap. Review and fix (all in your files):

1. **`index.html` inline script vs `app/nav.js`:** the inline script still has an old `PAGE_NAMES` map (no `invoices`, `standards`, old labels like "Team rewards"), toggles `.on` on `.mb-tab` and `.drawer-item`, and filters `[data-role]`. `nav.js` now does the title, `.on`, `aria-current` and the sheet. Remove the duplicated parts from the inline script (keep the demo banner, role pill and org-name observers). Verify: the breadcrumb shows "Compliance", "Invoices", "GST returns" correctly; `python scripts/rewards_test.py` stays green (it asserts `#top-page-name`).
2. **Role handling:** the `[data-role="admin"]` filter must work for items that `nav.js` creates (Team & access) in the sidebar and in the More sheet, for admin, finance and viewer, after a role switch and after reload.
3. **Empty and loading states for the 5 new pages** (Invoices, Items tab, Received tab, Compliance, Rewards store) in the same style as your 11 existing ones; use `icon()` from `app/icons.js` rather than inline SVG paths in new code, and migrate your older inline-SVG empty states to the same helper when you touch them.
4. **Skeletons:** show them on first paint for the data-heavy pages (Dashboard, Transactions, Invoices, Reports) and make sure they disappear on render and never flash on later re-renders; respect `prefers-reduced-motion`.
5. **PWA:** the manifest `screenshots` and `public/screen-*.png` show the old UI. Regenerate them with `scripts/capture_screens.py` after your redesign (Task 9). `offline.html` must use the same tokens and logo as the app. Bump `CACHE` in `sw.js` (`myf-v7` becomes `myf-v8`) when you change shell files. Install prompt: if there is no in-app install button yet, add one (uses `beforeinstallprompt`, hides itself when installed).
6. **Practice Lab:** confirm `lab.html` has the light/dark theme toggle honouring `localStorage['myf-theme']`, and that the "Finance Desk" link and the sidebar "Practice lab" link both work.
7. **Lighthouse (mobile) on `/index.html`:** target Performance 90+, Accessibility 95+, Best practices 95+, installable. Save the screenshot to `docs/lighthouse.png` (replace the old one).

**Done when:** no duplicated nav logic, all 16 pages have an empty state, roles behave, the Lighthouse targets are met or the gap is explained in `docs/screens/p4/NOTES.md`.

---

## Task 9 — Demo assets for the jury (≈2 h)

Follow `docs/PITCH.md` exactly so the pitch and the footage agree.

1. **Recording (90 seconds, 1440 x 900, light theme, demo mode, sample data loaded, sound off):** Today and a reminder, new invoice in another state with two GST rates and IGST, issue with Ctrl+Enter, download the PDF, show the linked transactions, open the e-way file, drag the cash-planner what-if slider, show the Compliance readiness, re-check the audit integrity, show Rewards > Who pays. No mouse hunting: rehearse twice; keep the cursor visible and slow.
2. **12 final screenshots** in `docs/screens/final/`, named `01-today.png` ... `12-more-sheet.png`: Today, Dashboard, New invoice, Invoice PDF page 1, Add transaction (Sale), Transactions with an invoice link, Cash planner, Compliance, Audit trail with the integrity result, Rewards store, Who pays, phone More sheet. Crisp (device scale factor 2), no toasts, no cursor, no personal data.
3. **Do not alter the data to flatter the numbers.** Use the built-in sample data only.

---

## Task 10 — Hand-off (≈1 h)

- Tick tasks in `TODO.md`, add a Work Log line per task, list open **Requests between owners**.
- Update `PROGRESS.md` only in the "UI" rows you changed.
- Write `docs/screens/p4/NOTES.md`: what you changed, what you deliberately did not, and any bug you found in Ram's logic (with steps to reproduce; do not fix it yourself).

## 3. Process (how we stay conflict-free)
- Branch `sumit/ui-phase-4` from the current `main`. Push after **every** task.
- **Every morning and before each push:** `git fetch origin && git rebase origin/main`. Because we own disjoint files this rebases cleanly. If git reports a conflict in a file you own, stop and ask Ram; if it is in a file Ram owns, you edited the wrong file: undo your change to it.
- Ram merges your branch into `main` after every two or three tasks and tells you in `TODO.md` ("merged up to task N"). After that, rebase again.
- **`app/bundle.min.css` is generated.** Never merge it by hand. If it ever conflicts: `git checkout --ours app/bundle.min.css && npm run build:css && git add app/bundle.min.css`. Commit it together with the CSS source change.
- One commit per task: `ui: task N — <what>`. Do not merge to `main` yourself.
- Run the six checks before every commit. If a test fails because you changed something it reads (see Contracts), change your markup back or ask Ram; **never edit a test to make it pass**.
- Update `TODO.md` after each task (tick, Work Log line, requests).
- Time budget about 30 hours. If you run short drop, in this order: Task 8 items 4 to 6, Task 6 popovers, Task 5 polish. Never drop Tasks 1, 2, 4, 7 or 9.

## 4. Report back (paste this at the end)
```
Tasks done: 1 2 3 ...            Tasks skipped and why: ...
Checks: selfcheck OK | UI SMOKE OK | FLOW OK | INVOICE OK | TXN OK | REWARDS OK | A11Y OK
Lighthouse (mobile): perf __ a11y __ best-practices __ pwa __
Open requests for Ram: ...       Bugs found in logic: ...
Assets: docs/screens/p4 (__ files), docs/screens/final (12 + recording)
```

## 5. Acceptance checklist
- [ ] All seven checks pass: `selfcheck`, `UI SMOKE`, `FLOW`, `INVOICE`, `TXN`, `REWARDS`, `A11Y`
- [ ] No horizontal scroll at 320 (forms), 375, 768, 1440 px on any page, light and dark, for admin, finance and viewer
- [ ] Body text contrast at least 4.5:1 and UI borders at least 3:1 in both themes; no hard-coded hex colours left in `workflow.css`
- [ ] Invoice can be created, issued and downloaded as PDF on a 375 px phone with taps only
- [ ] Print view and PDF verified for the 7 sample invoices; no overlap, no lost text, no orphaned totals
- [ ] One dialog system with bottom sheets on phones, focus returns to the opener
- [ ] Compliance, Rewards store and Who pays finished at all widths; "Aligned, not certified" always visible
- [ ] Fresh account shows one obvious next action; all empty states exist
- [ ] WCAG 2.2 AA manual checklist complete with proof; `A11Y OK`
- [ ] No duplicated nav logic between `index.html` and `nav.js`; empty states on all 16 pages; install button, offline page and manifest screenshots match the new UI; Lighthouse targets met
- [ ] 24 review screenshots + `REVIEW.md` in `docs/screens/p4/`, 12 final screenshots and the 90-second recording in `docs/screens/final/`
- [ ] `git diff --name-only origin/main...HEAD` lists only files from your row of the ownership table; no new runtime dependencies; tests not edited to pass
