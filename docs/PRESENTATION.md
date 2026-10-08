# How to present Mind Your Funds, step by step

This is the exact running order, the clicks, the words, and what to avoid. It is written for a 7-minute slot (a 4-minute cut is at the end). Everything here exists in the repo today and passes its tests.

## 1. The story in one breath

> Small businesses do not fail because they are unprofitable. They fail because cash, GST and payroll collide on the wrong day, and nobody on the team is a finance person. **Mind Your Funds is one place that runs the money routine for them, tells them what to do next, and teaches them while they do it.** And you can practise the scary moments in a 90-day simulator before they happen for real.

Three ideas to repeat during the demo, in this order:
1. **Do the work.** Real GST invoices, payroll, e-way bill files, approvals, one set of books.
2. **See what is coming.** Cash forecast, compliance dates, an AI CFO that reads your real numbers.
3. **Learn by deciding.** Light gamification on real habits, and a Practice Lab where a crew advises, you decide, and a twin that never listened shows what it would have cost.

Map it to the problem statement out loud: *scattered tools, no finance team, need to stay healthy and decide better.* Invoices, payroll, tax and cash are all in one app (the first half). Better decisions come from the forecast, the AI explanation and the Practice Lab (the second half).

## 2. Before you walk on stage (T minus 30 minutes)

Run these once, in this order. If anything fails, switch to the backup in section 7.

1. `git pull` and `node core/selfcheck.js` (must print `selfcheck OK`).
2. Start the app with the AI proxy: `npm run dev` (restart it if `.env` changed). `.env` needs `GROQ_API_KEY`; the model is `openai/gpt-oss-20b`. Quick proof: `python scripts/ai_test.py` prints `AI OK`.
3. Open the app, **hard reload (Ctrl+Shift+R) twice** so no old cached script is served. Choose **Continue in demo mode** (use demo mode on stage: it needs no sign-in and no network except the AI).
4. **Settings > Load sample data.** Then **Settings > Invoice details**: type an address and a UPI id, and set the company GSTIN to a valid one (for example `27AAPFU0939F1ZV`) so invoices show GST properly.
5. Open **Payroll > Employees > Import CSV** with the template (3 employees) so the payroll run is ready. Do not run it yet.
6. **Pre-play a finished Practice Lab run in a second tab.** Open the Practice Lab, check the cash tile reads **₹2,00,000** (confirms the latest code), click **Start quarter**, then **Auto-play**. It stops at every decision; answer each with the recommended option. The 90 days take about 1.5 minutes. Leave that tab open on the **result popup** (do not click Go Back or New run). A full run takes too long to play live, so on stage you play the first decisions live and switch to this tab for the ending.
7. Browser at 100% zoom, light theme for the projector, notifications off, one tab each for: the app, the Practice Lab, a folder with the downloaded PDF.
8. Optional but powerful: apply the Supabase migrations first (`npx supabase db push`) and show cloud mode. If you have not done that, stay in demo mode and say so honestly (section 6).

## 3. The 7-minute running order

Timings are targets. The driver clicks, the speaker talks; do not both do both.

| Time | Screen | What you do (exact clicks) | What you say |
|---|---|---|---|
| 0:00 to 0:40 | Slide 1 (problem) | none | The one-breath story above. Name the problem statement. |
| 0:40 to 1:20 | **Today** | Point at the five steps, the health ring and one alert. Click **Send reminder** on the overdue invoice. | "Every morning the app tells the owner exactly what to do. This alert is real: an overdue invoice. One click prepares the reminder, and it earns XP. The score is not a game; it rewards the habits that keep a business alive." |
| 1:20 to 2:30 | **Invoices** | **New invoice**. Pick a customer in another state. Add two lines: one 18%, one 5%. Point at IGST appearing and the live total. Press **Ctrl+Enter**, confirm. Click **PDF**. Open the file. Then **Transactions**: show the linked rows and the PDF button. Open **E-way** and show the "needed" banner and the NIC file. | "A real tax invoice: the right tax by state, HSN, number series, amount in words. Issuing it created the sales entries, so GST, cash and the planner already know. If goods move, we prepare the e-way bill upload. Invoices from another company can be accepted into your books with input credit." |
| 2:30 to 3:30 | **Payroll** | **Run payroll**. Type a bonus for one person and watch net pay change. **Submit for approval**, then **Approve payroll**, then **Mark salaries paid**. Click **All payslips (PDF)**. Point at the streak and the badge. | "Payroll with PF, ESI, professional tax and TDS estimates. Finance prepares, an admin approves: two people, so no one pays themselves. Approval created the salary and the statutory dues in the books with due dates, so the forecast includes them. Paying on time builds a streak." |
| 3:30 to 4:20 | **Cash planner**, then **AI CFO** | Drag the what-if slider ("customers pay 20 days later"). Then **AI CFO > Can I afford a new hire?** | "The forecast uses each customer's own payment delay. The AI CFO reads totals from the books: cash, overdue, GST, the forecast low point. It never sees a name or a GSTIN, and the numbers come from tested code. The model only explains." |
| 4:20 to 5:00 | **Compliance**, then **Audit trail** | Show the readiness ring and the standards list. Click **Re-check integrity**. | "Every action is written to a hash-chained log: change any past entry and the chain breaks. It is tamper-evident, not a blockchain. We map our controls to ISO 27001, WCAG and the DPDP Act, and we say aligned, not certified." |
| 5:00 to 6:30 | **Practice Lab** | Open it. **Start quarter**. Click **Auto-play**. When it stops at the first decision, read the "What's happening" and "Why does it matter" lines aloud. Choose the recommended option. Show the **Decision impact**, the lesson link and the streak toast. Point at the two health bars at the top right (you against the unassisted twin, live). Click **Previous Day** once to show the rewind, then **Next day**. Then switch to the pre-played tab and show the **Ghost Twin** result popup. | "The crew explains each problem in plain language. You decide. The impact is computed from the real simulation, then it points at the matching lesson. Auto-play stops by itself for every decision and carries on after you answer. At the end of a quarter, the same business and the same shocks, without a crew: here is the difference in health, in cash and in fraud losses. This is a finished run." |
| 6:30 to 7:00 | **Rewards > Who pays** | Open the tab. | "Points and badges are free. Cash rewards come from a monthly pool that the company sets, capped by the database, approved by an admin. We never hold or move money." |

Close on the slide: what is done, what is next (server-side XP, real reminders, bank feed, e-invoice), and the ask (a pilot).

## 4. Why each scene is there (so you can improvise)

- **Today** proves it is a daily tool, not a report.
- **Invoices** is the money-making feature for a small business, and the proof that "one set of books" is real: one action, many screens updated.
- **Payroll** shows depth (statutory maths, maker-checker) and the gamification applied to a serious duty.
- **Planner and AI CFO** answer "better decisions". Keep saying "real numbers, explained".
- **Compliance and Audit** answer "can we trust it" for judges who care about security and regulation.
- **Practice Lab** is the memorable part: it is the "gamified" in the brief, and it is where the Ghost Twin makes the value visible in one picture.
- **Who pays** pre-empts the question every jury asks about rewards.

## 5. Exactly what to say about the hard questions

- **What model, and how does the AI work?** "Open models served by Groq, currently GPT-OSS 20B. The AI only explains numbers. GST, forecasts, fraud flags and approvals are normal tested code. It sees totals only, never names." (Details in `docs/JUDGES_QA.md`.)
- **Is the ledger a blockchain?** "No. It is a SHA-256 hash-chained, append-only log. It detects any change to history. We chose it over a blockchain because there is no distrust to solve, public chains clash with privacy and erasure rules, and a chain adds cost. Publishing the latest hash to a public timestamp is on the roadmap."
- **Is the data real?** "The demo uses fictional sample data and a seeded simulation. We have no customers yet; this is a prototype for a pilot."
- **Is it certified or compliant?** "Aligned with the controls, not certified. Certification needs an external audit."
- **Does it scale?** "Static hosting plus managed Postgres, no servers to run. Known limit: no paging yet, fine for thousands of rows. Not load-tested."
- **What is not done?** Say it first, before they find it: cloud migrations are written and tested in demo mode and still to be applied to the live project, XP is computed in the browser, reminders are copy and WhatsApp links, e-way bills are prepared but generated on the NIC portal, e-invoice and Form 16 are not built.

## 6. Demo mode or cloud mode?

- **Demo mode** (recommended for the stage): works offline, nothing to break. Say once: "This runs in demo mode with its data in the browser; in cloud mode the same app stores everything in Supabase with role-based access in the database."
- **Cloud mode**: only if you have applied all ten migrations and run through it twice. Sign in, create the workspace, and keep the sample-data script ready. Do not try cloud mode for the first time on stage.

## 7. If something breaks

| Problem | Do this |
|---|---|
| AI answers with the offline sentence | Say "the AI is optional by design; the numbers on screen are the product". Check `npm run dev` is running. Move on. |
| The app looks like an old version | Ctrl+Shift+R twice, or DevTools > Application > Service Workers > Unregister. |
| A download is blocked | Allow downloads for the site before you start; keep the PDFs pre-generated in a folder. |
| The projector or network fails | Play the 90-second recording from `docs/screens/final/` (Sumit's task 9). Keep it on a USB stick and on the laptop. |
| You lose your place | Go to **Today** (press `g` then `t`) and restart from the next row of the table. |

Useful keys to show off if time allows: **Ctrl+K** (search anything), **`?`** (all shortcuts), **`i`** new invoice, **`n`** new transaction.

## 8. The 4-minute cut

Keep: problem (30 s), **Invoices** (60 s), **Payroll** (45 s), **AI CFO** (20 s), **Practice Lab** with auto-play stopping at one decision and the Ghost Twin (75 s), close (10 s). Drop: Today, planner slider, compliance, rewards. Mention them in one sentence each as "also built".

## 9. Who does what on stage (suggested; adjust to your team)

- **Speaker** (the strongest storyteller): problem, narration, close.
- **Driver** (whoever knows the clicks best): keyboard and mouse, follows section 3 exactly, never speaks over the speaker.
- **Technical backup** (third person): answers the model, ledger, security and scale questions with section 5, and watches the clock.

## 10. Rehearsal checklist

- [ ] Rehearsed twice with a timer; the run is 7 minutes or less.
- [ ] Every number mentioned is read from the screen, not memorised.
- [ ] The sample data is loaded fresh before each rehearsal (Settings > Load sample data).
- [ ] The deck matches the product: it was built earlier, so check it mentions invoices and PDF, payroll, compliance, rewards pool, the Practice Lab coach and rewind, and the real AI model. Update any slide that says otherwise.
- [ ] Nobody says "blockchain", "certified", "ML model", "real customers" or "live in production".
- [ ] Recording and pre-generated PDFs are on the laptop and on a USB stick.

## 11. What the jury should remember (the last 20 seconds)

1. One app for invoices, payroll, GST, cash and compliance.
2. Real numbers explained by an AI, never invented by one.
3. A Practice Lab that turns financial discipline into a skill, and shows the cost of ignoring advice.
4. Honest about what is real, what is a prototype and what is next.
