> The exact running order, clicks, words and rehearsal checklist are in [PRESENTATION.md](PRESENTATION.md). This file keeps the background on how insights are generated.

# Pitch guide: Mind Your Funds (Oxro Labs Finance Desk)

## How the insights are generated (say this plainly)

Nothing is "magic AI". Insights are **rules over the company's own ledger**, with a language model used only to put them in words.

| Insight | How it is produced |
|---|---|
| **Alerts** (overdue invoice, bill due soon, negative cash, duplicate invoice, unusually large bill, input credit at risk) | Deterministic checks in `workspace/calc.js`. Example: an invoice past its due date raises an alert with the days late and the amount. A bill more than 3 times the average purchase raises a "large bill" alert. |
| **Health score (0 to 100)** | `40%` runway (3 months of spending = full marks) + `35%` share of receivables that is not overdue + `25%` share of GST input credit that is safe. Same inputs always give the same score. |
| **60-day cash forecast** | `workspace/planner.js`: each customer's own past payment delay (from paid invoices) shifts when we expect their money; known bills and payroll go out on their due dates. Scenarios: base, everyone late, everyone on time, plus a what-if slider. |
| **Tips and pay priority** | Rules: runway under 1 month, one customer owing more than half of what is outstanding, spend up over 20% month on month, GST to set aside. Each tip shows the numbers that triggered it. |
| **GST position** | `tax/gst.js`: intra vs inter-state split, input tax credit netting, due dates. Planning estimates, verify with a CA. |
| **AI CFO** | The totals above are sent to a hosted language model (Groq: Llama or gpt-oss), which explains them in under 80 words. No names, GSTINs or invoice lines are sent. If the model is down, a fixed sentence is shown. |

Key line: **"The numbers come from tested code. The AI only explains them."**

## Five-minute talk track

1. **Problem (30 s).** Small businesses juggle invoices, bills, payroll, GST and cash across scattered tools, with no finance team. They find out about a cash gap or a missed GST date too late.
2. **Who it is for (15 s).** Owner-run Indian businesses and internal finance teams like Oxro Labs. Three roles: admin, finance, viewer.
3. **Solution in one sentence (15 s).** One place that runs the daily, weekly and month-end finance routine, tells you what to do next, and makes it a habit through light gamification.
4. **Live demo (2 min).** See the script below.
5. **What makes it different (45 s).**
   - Guided routine ("Today"), not a dashboard you must interpret.
   - Real GST invoices, e-way bill data and received invoices from other organisations.
   - Tamper-evident audit trail with the reason for every action.
   - Forecast that learns each customer's payment delay.
   - Gamification that pays out in habits, with company-funded real rewards under a hard monthly cap.
6. **Trust and honesty (30 s).** Say what is real and what is planned (see below).
7. **Close (15 s).** Pilot with Oxro Labs, then onboard small businesses.

## Demo script (2 minutes, demo mode, sample data loaded)

1. **Today:** "Five steps for today. It found an overdue invoice and suggests a reminder." Click *Send reminder*.
2. **Invoices > New invoice:** pick a customer in another state, add two lines at 18% and 5%. Point at IGST appearing and the live total. Press Ctrl+Enter to issue.
3. **Download PDF**, then open **Transactions** to show the sale entries were created and linked.
4. **E-way bill:** open it, show the "required" check and the NIC upload file.
5. **Cash planner:** drag the what-if slider ("customers pay 20 days later") and watch the forecast.
6. **Compliance:** readiness score, due dates, ISO/WCAG/DPDP mapping, "Aligned, not certified".
7. **Audit trail > Re-check integrity:** "every action is hash-chained".
8. **Rewards > Who pays:** points are free, cash rewards come from a company pool capped by the database.

## What to specify (checklist for the jury)

- **Scope:** what works today (11+ pages, 3 roles, invoices, GST, approvals, planner, rewards) and what is a pilot.
- **Data:** where it lives (Supabase, per-company access rules), what leaves the browser (aggregates only, to the AI).
- **AI:** model family, what it does, what it does not, fallback when offline.
- **Synthetic data:** fictional fixtures and a seeded simulation, no real customers yet.
- **Ledger:** SHA-256 hash-chained, tamper-evident, not a blockchain, and the upgrade path (signatures, published hash).
- **Compliance:** aligned with ISO 27001/27701/9001 controls, WCAG 2.2 AA, DPDP and GST invoice rules. Not certified.
- **Business model:** gamification points are free. Cash-value rewards are paid by the customer company from its own pool, or by a labelled sponsor later. We never hold or move money.
- **Scale and cost:** static hosting plus managed database, no servers to run. Known limit: no paging yet, so fine for thousands of rows.
- **Testing:** logic self-check, end-to-end tests for invoices, transactions, rewards and the workflow, and a page smoke test across roles, themes and screen sizes.
- **Roadmap:** server-side XP, real reminders by WhatsApp and email, bank feeds, e-invoice (IRN), TDS and PF.

## Do not claim

- "Blockchain" (it is a hash-chained log).
- "ISO certified" (aligned, not certified).
- "AI predicts" or "ML model" (rules plus a language model that explains).
- "Real customers" or accuracy figures (we have none yet).
- That e-way bills are generated automatically (we prepare the upload file; the bill is generated on the NIC portal).
- That tax figures are final (planning estimates, verify with a CA).

## Likely questions

See [JUDGES_QA.md](JUDGES_QA.md): model, synthetic data, blockchain, scale, AI use.
