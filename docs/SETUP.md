# Mind Your Funds setup

## Run locally
```bash
node core/selfcheck.js      # engine + GST + ledger checks (must print "selfcheck OK")
npx serve .                 # open http://localhost:3000  (works fully offline, no keys)
```

## Supabase (optional, ~5 min)
1. supabase.com → New project. Authentication → Providers → enable **Anonymous Sign-Ins**.
2. SQL editor → paste `supabase/migrations/20261008000000_init_mind_your_funds.sql` → Run.
3. Project Settings → API → copy **Project URL** and **anon public key** into `config.js`.
4. Play a run: rows appear in `runs` (status won/lost at the end) and `ledger_entries` (one per decision).
Never put the `service_role` key anywhere in this repo.

## Business workspace (real use)
The main app is `index.html` (`app/`): sign in, transactions, GST & compliance, rewards, audit trail. All data lives in Supabase; demo mode keeps it in the browser. Tracker: `PROGRESS.md`.
1. Apply ALL migrations in `supabase/migrations/` (`npx supabase db push` after `supabase link`).
2. Auth -> URL Configuration: add your site URL (and http://localhost:3000) to Redirect URLs; Email provider enabled.
3. Put `SUPABASE_ANON_KEY` in `.env`, run `npm run sync-env`.

## Groq (optional)
1. console.groq.com → API key.
2. Local: copy `.env.example` to `.env`, fill `GROQ_API_KEY`, then run **`npm start`** (site plus AI proxy at http://localhost:3000, no Netlify CLI needed) or `npm run dev` (Netlify CLI serves the site and `/api/groq`; restart it after changing `.env`). A plain static server (`npx serve`, `python -m http.server`) has no `/api/groq`, so the AI shows its offline text and the console says why. Models differ per Groq account: the proxy tries `GROQ_MODEL`, then `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, then the Llama models, and uses the first one your key can access. `python scripts/ai_test.py` checks the whole path with your key.
3. Deploy: Netlify → Site settings → Environment variables → `GROQ_API_KEY`, `GROQ_MODEL`.
Without a key the game uses template text (the "AI wording" toggle and Ask-the-CFO just fall back).

## Deploy
`npx netlify-cli deploy --prod` (publish dir is `.`; functions in `netlify/functions`).

## Architecture in one glance
`core/engine.js` is the only code that mutates state. Agents (`agents/*`) turn events into Cards; `EFFECTS` in the engine apply the chosen option. `main.js` bridges engine → bus → ledger/UI/Supabase. Ghost Twin = `createGame(seed,{crew:false})`.
