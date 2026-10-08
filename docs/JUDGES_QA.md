# Judges' questions: model, data, AI, ledger

Every answer below matches the code in this repo. Say these, not more.

## 1. Which model do you use, and how does the AI work?

- **Model:** open-weight LLMs served by **Groq**: `llama-3.1-8b-instant` by default, with fallbacks `openai/gpt-oss-20b` and `openai/gpt-oss-120b` (the proxy tries the next one if a model is not enabled). Set `GROQ_MODEL` to choose another. We do **not** train or fine-tune anything.
- **Where it runs:** the browser calls our own serverless proxy (`netlify/functions/groq.js`). The API key stays on the server. The proxy limits messages (6 messages, 2,000 characters), rate-limits to 20 requests a minute per IP, and times out after 8 seconds.
- **What it is for:** it only **explains** numbers in plain English (AI CFO answers, short coaching text). Temperature is 0.2 and answers are capped at about 60 to 80 words.
- **What it does not do:** it never calculates tax, forecasts cash, approves spending or touches the ledger. Those are deterministic code you can test: `tax/gst.js`, `tax/invoice.js`, `workspace/planner.js`, `core/selfcheck.js`.
- **Privacy:** it receives **aggregate numbers only** (cash, runway, health score, counts). No party names, GSTINs or invoice lines leave the browser for the AI.
- **If the model is down:** every call has a fixed fallback (a rule-of-thumb sentence), so the product works with the AI offline.
- **The "agents"** in the Practice Lab (Collector, Treasurer, Sentinel, Scout) are rule-based programs, not machine learning. Example: Sentinel flags a bill when the vendor bank account changed, the GSTIN checksum fails, or the amount is round.

## 2. What is the synthetic data and how is it generated?

There are three kinds, and none contains real people or companies.

| Where | What | How |
|---|---|---|
| **Settings > Load sample data** (and `supabase/seed.sql`) | 12 invoices, bills, expenses and payroll rows for "Oxro Labs" with fictional customers (Sharma Traders, Bluebird Retail...) and `.example` emails | Hand-written fixtures. Dates are relative to today so some invoices are overdue. GSTINs are produced by our own checksum function (`makeGstin`), so they pass validation but are not registered. One bill has no GSTIN on purpose to show input-credit risk. |
| **Practice Lab** (`lab.html`, `core/`) | A 90-day business simulation: invoices, vendor bills, payroll, GST dates, fraud attempts | A **seeded pseudo-random generator** (mulberry32, `core/rng.js`) plus a scripted event timeline (`core/events.js`). The same seed gives the same run, which is how the "Ghost Twin" comparison works: the crew playing recommended options is compared to a passive twin on identical events. |
| **Tests** (`scripts/*_test.py`) | Demo companies and invoices | Created inside each test run. |

Be upfront: the sample data shows how the product behaves. It is **not** a benchmark of real-world accuracy, and we have no real customer data yet. The seed script that generated `seed.sql` (`scripts/_gen_seed.mjs`) was a one-off and is not kept in the repo.

## 3. "You said blockchain ledger." What is it really?

**It is not a blockchain.** It is a **hash-chained, append-only audit log**, the same tamper-evidence idea as a blockchain block chain but without a network, consensus or tokens. Our own legal page already says this. Use the words *"tamper-evident hash-chained ledger"*, not "blockchain".

How it works (`ledger/blackbox.js`):
1. Every action (issue invoice, approve spend, change a role, redeem a reward) becomes an entry: number, day, who, what, why.
2. `hash = SHA-256(previous hash + the entry)`. Each entry depends on the one before it.
3. Entries are stored in Supabase (`activity_log`). The database has **no update or delete policy** for it, so ordinary users can only add rows.
4. "Re-check integrity" (Compliance page) recomputes the whole chain in the browser. If any past entry was edited, deleted or reordered, verification fails at the first broken entry.
5. Chains are per user. Admins can read the whole company's log.

What it **proves**: the log has not been changed *without detection* since it was written, and who did what in what order.
What it **does not prove** (say this before they ask):
- It is not decentralised. Someone with full database access could rewrite the **entire** chain consistently, because entries are not digitally signed and the latest hash is not published anywhere outside our database.
- The hash is computed in the browser, so a malicious client could write false entries (it cannot silently change old ones).
- It proves integrity, not that the underlying fact was true.

**Upgrades that would make "authenticity" claims stronger** (not built; in `NEXT_STEPS.md`):
1. Sign each entry with a per-user key (WebCrypto ECDSA) so rewriting history needs their key.
2. Publish the latest chain hash on a schedule to a place we cannot edit (a signed timestamp, or a public testnet), so a full rewrite is detectable.
3. Compute the hash in a database trigger so a client cannot forge entries.

## 4. One-line answers

- **Model?** Open Llama / gpt-oss models via Groq, used only to explain numbers.
- **Does AI do the maths?** No. GST, forecasts and approvals are deterministic code with tests.
- **Does AI see our data?** Aggregates only. No names, GSTINs or invoices.
- **Synthetic data?** Fictional fixtures plus a seeded simulation. Same seed, same run. No real data.
- **Blockchain?** No. A SHA-256 hash-chained append-only audit log. Tamper-evident, not decentralised.
