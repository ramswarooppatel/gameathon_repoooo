"""Generates welcome.html (landing) and legal/*.html from one source so header, footer and theme wiring stay identical.
Run: python scripts/gen_site.py     Fill the highlighted [placeholders] in LEGAL_CONTACT below before a public launch."""
import os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPDATED = '8 October 2026'
FILL = lambda s: f'<span class="fill">[{s}]</span>'
CO = 'Oxro Labs'

EARLY = """<script>(function(){try{var p=localStorage.getItem('myf-theme')||'system',l=p==='light'||(p==='system'&&matchMedia('(prefers-color-scheme: light)').matches);var d=document.documentElement;d.dataset.theme=l?'light':'dark';d.dataset.fs=localStorage.getItem('myf-fs')||'md';d.dataset.contrast=localStorage.getItem('myf-contrast')||'normal';}catch(e){document.documentElement.dataset.theme='dark';}})();</script>"""


def page(title, desc, body, base='', active=''):
    nav = ''.join(f'<a href="{base}welcome.html#{a}">{t}</a>' for a, t in [('different', 'Why it is different'), ('features', 'Features'), ('security', 'Security'), ('faq', 'FAQ')])
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}">
<link rel="icon" href="{base}public/logo-64.png" type="image/png"><meta name="theme-color" content="#08110e">
{EARLY}
<link rel="stylesheet" href="{base}public/site.css"></head>
<body>
<a class="skip-link" href="#view">Skip to main content</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="{base}welcome.html"><span class="logo"><img src="{base}public/logo-128.png" alt="" width="36" height="36"></span><span>{CO} Finance Desk<small>by Mind Your Funds</small></span></a>
  <nav class="site-nav" aria-label="Primary">{nav}</nav>
  <div class="top-actions"><a class="btn pri" href="{base}index.html">Open Finance Desk</a></div>
</div></header>
<main id="view">
{body}
</main>
<footer class="site-foot"><div class="wrap">
  <div class="foot-grid">
    <div><a class="brand" href="{base}welcome.html" style="padding:0"><span class="logo"><img src="{base}public/logo-128.png" alt="" width="36" height="36"></span><span>{CO} Finance Desk</span></a><p>Finance, GST and compliance for small businesses and internal teams, with habits that stick.</p></div>
    <div><h4>Product</h4><a href="{base}welcome.html#features">Features</a><a href="{base}welcome.html#different">What is different</a><a href="{base}welcome.html#security">Security</a><a href="{base}index.html">Open the app</a></div>
    <div><h4>Legal</h4><a href="{base}legal/terms.html">Terms of Service</a><a href="{base}legal/privacy.html">Privacy Notice</a><a href="{base}legal/disclaimer.html">Disclaimer</a><a href="{base}legal/accessibility.html">Accessibility</a></div>
    <div><h4>Resources</h4><a href="{base}welcome.html#faq">FAQ</a><a href="{base}lab.html">Practice Lab</a><a href="https://sdgs.un.org/goals" rel="noopener">UN SDGs 8 · 9 · 16</a></div>
  </div>
  <p class="legal-note">&copy; 2026 {CO}. Figures shown are planning estimates and not tax, legal or financial advice. See the <a style="display:inline" href="{base}legal/disclaimer.html">Disclaimer</a>.</p>
</div></footer>
<script type="module" src="{base}app/extras.js"></script>
</body></html>
"""


# ------------------------------------------------------------------ landing page
LANDING = f"""
<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">Finance desk for small businesses and teams</span>
    <h1>Know your cash, GST and risks every day. Win the habits that keep you healthy.</h1>
    <p class="lead">One place for invoices, bills, payroll and GST. It warns you before a payment is late or a deadline is missed, asks for approval where it matters, and rewards the good financial habits.</p>
    <div class="cta-row"><a class="btn pri lg" href="index.html">Open Finance Desk</a><a class="btn lg" href="index.html">Try demo mode</a></div>
    <p class="fine">Demo mode needs no account and keeps data in your browser. Free during the pilot.</p>
  </div>
  <div class="shot"><img class="only-dark" src="public/shots/dashboard-dark.webp" width="1200" height="750" fetchpriority="high" decoding="async" alt="Finance Desk dashboard with business card, health score and stories (dark theme)"><img class="only-light" src="public/shots/dashboard-light.webp" width="1200" height="750" fetchpriority="high" decoding="async" alt="Finance Desk dashboard with business card, health score and stories (light theme)"></div>
</div></section>

<section class="stats" aria-label="Why this matters"><div class="wrap"><div class="stat-grid">
  <div class="stat"><b>7.61 crore</b><span>MSMEs registered in India <a class="ref" href="#refs">[1]</a></span></div>
  <div class="stat"><b>27 days</b><span>median cash buffer of a small business <a class="ref" href="#refs">[5]</a></span></div>
  <div class="stat"><b>₹36,014 cr</b><span>bank fraud reported in FY25 <a class="ref" href="#refs">[4]</a></span></div>
  <div class="stat"><b>1.51 crore</b><span>GST registrations on monthly deadlines <a class="ref" href="#refs">[3]</a></span></div>
</div></div></section>

<section class="block" id="different"><div class="wrap">
  <div class="sec-head"><span class="tag">What makes it different</span><h2>Not just bookkeeping. Proof, control and a reason to come back.</h2><p>Most tools record what happened. Finance Desk shows what it saved you, keeps a tamper-evident record of every decision, and makes the daily routine something people actually do.</p></div>
  <div class="grid g3">
    <article class="card novel"><div class="ico">1</div><h3>Ghost Twin: proof, not claims</h3><p>The Practice Lab runs the same business and the same shocks twice: once with the crew, once without. In our simulation the unassisted twin ran out of cash on day 30 while the crew ended day 90 at a health score of 84.</p></article>
    <article class="card novel"><div class="ico">2</div><h3>Why-Receipts on a hash chain</h3><p>Every action stores who did it, what changed and why, chained to the previous record with SHA-256. Edit history and the chain breaks, and the audit page shows it.</p></article>
    <article class="card novel"><div class="ico">3</div><h3>Control enforced in the database</h3><p>Roles (admin, finance, viewer) and approvals above a spend limit are enforced by row-level security and triggers, not just hidden buttons. Non-admin spend above the limit waits for an admin.</p></article>
    <article class="card novel"><div class="ico">4</div><h3>A habit loop tied to real outcomes</h3><p>XP, streaks, quests, badges and a daily scratch reward are earned by collecting on time, filing on time and resolving alerts, never by screen time. Research reviews report mostly positive effects of gamification <a class="ref" href="#refs">[7]</a>.</p></article>
    <article class="card novel"><div class="ico">5</div><h3>Stress test before the shock</h3><p>See your cash in 30 days if every customer pays late, and a 14-day look-ahead of what is due, so you act before the wave and not after it.</p></article>
    <article class="card novel"><div class="ico">6</div><h3>AI that only sees aggregates</h3><p>The AI CFO answers on totals such as cash, dues and runway. Names and GSTINs never leave your workspace, and every question is logged.</p></article>
  </div>
  <h3 style="margin:34px 0 12px">How it compares</h3>
  <div class="table-scroll"><table class="compare"><thead><tr><th>Capability</th><th>Spreadsheets</th><th>Accounting apps</th><th>Banking apps</th><th>Finance Desk</th></tr></thead><tbody>
    <tr><td>Proactive risk alerts</td><td class="no">No</td><td class="part">Partly</td><td class="part">Partly</td><td class="yes">Yes</td></tr>
    <tr><td>GST credit check and filing calendar</td><td class="no">No</td><td class="part">Partly</td><td class="no">No</td><td class="yes">Yes</td></tr>
    <tr><td>Approvals with roles</td><td class="no">No</td><td class="part">Partly</td><td class="no">No</td><td class="yes">Yes</td></tr>
    <tr><td>Tamper-evident audit with reasons</td><td class="no">No</td><td class="no">No</td><td class="no">No</td><td class="yes">Yes</td></tr>
    <tr><td>Habit loop (XP, streaks, rewards)</td><td class="no">No</td><td class="no">No</td><td class="part">Partly</td><td class="yes">Yes</td></tr>
    <tr><td>Proof of benefit (Ghost Twin)</td><td class="no">No</td><td class="no">No</td><td class="no">No</td><td class="yes">Yes</td></tr>
  </tbody></table></div><p class="fine" style="margin-top:8px">A generalised comparison of typical tool categories, not of any named product.</p>
</div></section>

<section class="block" id="how"><div class="wrap">
  <div class="sec-head"><h2>How it works</h2></div>
  <div class="steps">
    <div class="card"><h3>Capture</h3><p>Add invoices, bills, payroll and expenses, import a bank CSV, or set recurring entries.</p></div>
    <div class="card"><h3>Validate</h3><p>GSTIN checksum, CGST/SGST/IGST split and input credit are checked as you type.</p></div>
    <div class="card"><h3>Alert &amp; decide</h3><p>Ranked alerts with one-click actions. Approvals above your limit wait for an admin.</p></div>
    <div class="card"><h3>Record &amp; reward</h3><p>Each action is logged with its reason, and good habits earn XP, streaks and badges.</p></div>
  </div>
</div></section>

<section class="block" id="features"><div class="wrap">
  <div class="sec-head"><h2>Everything a small finance team needs</h2><p>Built for owners without a finance team and for company teams that want a shared, auditable desk.</p></div>
  <div class="grid g4">
    <div class="card"><h3>Health score</h3><p>Runway, on-time collections and credit safety in one number.</p></div>
    <div class="card"><h3>GST &amp; compliance</h3><p>GSTR-1 and GSTR-3B calendar, monthly position, input credit and interest estimate.</p></div>
    <div class="card"><h3>Customers &amp; vendors</h3><p>Directory with GSTIN autofill and one-click WhatsApp or email reminders.</p></div>
    <div class="card"><h3>GST invoices</h3><p>Print or save a tax invoice with the CGST/SGST/IGST breakdown.</p></div>
    <div class="card"><h3>Reports</h3><p>Profit and loss, receivables and payables aging, top parties, GST by month.</p></div>
    <div class="card"><h3>Bank reconcile</h3><p>Import a CSV and match payments to open invoices and bills by amount.</p></div>
    <div class="card"><h3>Team &amp; access</h3><p>Invite codes, email-domain lock, roles and an approval policy.</p></div>
    <div class="card"><h3>Works everywhere</h3><p>Light and dark themes, large text, high contrast, phone-friendly, installable.</p></div>
  </div>
</div></section>

<section class="block" id="security"><div class="wrap cols">
  <div><span class="tag">Security &amp; trust</span><h2>Your books stay yours</h2><p class="lead" style="font-size:17px">Built on managed Postgres with row-level security, so each company only sees its own data, and every sensitive action leaves a trace.</p>
    <ul class="checks">
      <li>Row-level security and role checks enforced in the database</li><li>Tamper-evident SHA-256 audit chain, exportable</li>
      <li>Email-domain lock and invite codes for company workspaces</li><li>No advertising or tracking cookies; storage used only for sign-in and preferences</li>
      <li>AI sees aggregate figures only, never names or GSTINs</li><li>Privacy notice aligned to India&rsquo;s DPDP Act 2023 principles (<a href="legal/privacy.html">read it</a>)</li></ul></div>
  <div class="card"><h3>Planning estimates, not advice</h3><p>GST rates, due dates and interest are simplified for planning. Always confirm with your Chartered Accountant before filing. AI answers can be wrong. See the <a href="legal/disclaimer.html">Disclaimer</a> and <a href="legal/terms.html">Terms</a>.</p>
    <p style="margin-top:12px">Aligned with UN SDG 8 (decent work and growth), SDG 9 (industry, innovation and infrastructure) and SDG 16 (strong institutions) <a class="ref" href="#refs">[10]</a>.</p></div>
</div></section>

<section class="block" id="faq"><div class="wrap">
  <div class="sec-head"><h2>Frequently asked questions</h2></div>
  <details><summary>Is this tax or legal advice?</summary><p>No. It gives planning estimates based on simplified GST rules. Confirm figures with your Chartered Accountant before filing.</p></details>
  <details><summary>Where is my data stored?</summary><p>In your company&rsquo;s Supabase (Postgres) workspace with row-level security. Demo mode stores data only in your browser.</p></details>
  <details><summary>Who can see what?</summary><p>Admins see everything, including the company-wide audit trail. Finance users can add and edit records but cannot delete, approve or manage the team. Viewers are read-only.</p></details>
  <details><summary>Does the AI see my customer names?</summary><p>No. The AI CFO receives aggregate numbers only, such as cash, dues and runway.</p></details>
  <details><summary>Can I use it on my phone?</summary><p>Yes. It is a responsive web app you can install from your browser, with light and dark themes, large text and high-contrast options.</p></details>
  <details><summary>How much does it cost?</summary><p>It is free during the pilot. We will give notice before any pricing is introduced.</p></details>
  <details><summary>Can I export my data?</summary><p>Yes. Transactions and the audit trail export as CSV or JSON, and reports can be printed or saved as PDF.</p></details>
</div></section>

<div class="cta-band"><div class="wrap"><h2>See it with sample data in under a minute</h2><p>Open demo mode, load the sample company, and watch the alerts, GST position and rewards come alive.</p><a class="btn pri lg" href="index.html">Open Finance Desk</a></div></div>

<section class="block" id="refs"><div class="wrap">
  <h3>References</h3>
  <ol class="ref" style="padding-left:20px;line-height:1.7">
    <li>Ministry of MSME, Annual Report 2025-26: 7.61 crore registered MSMEs (as of 31 Jan 2026). msme.gov.in</li>
    <li>PIB, Udyami Diwas – MSME Day 2025: MSMEs contribute about 30% of GDP and over 45% of exports. pib.gov.in</li>
    <li>PIB, Eight Years of GST: 1.51 crore active registrations; ₹22.08 lakh crore gross GST in FY25. pib.gov.in</li>
    <li>RBI Annual Report 2024-25: bank frauds of ₹36,014 crore across 23,953 cases (as reported by Business Standard).</li>
    <li>JPMorgan Chase Institute, “Cash Is King” (2016): median small-business cash buffer of 27 days (US data).</li>
    <li>Income-tax Act s.43B(h): 45-day payment rule for MSME suppliers from 1 April 2024.</li>
    <li>Hamari, Koivisto &amp; Sarsa (2014), “Does Gamification Work?”, HICSS-47, doi:10.1109/HICSS.2014.377.</li>
    <li>GST portal due dates: GSTR-1 (11th) and GSTR-3B (20th). gst.gov.in</li>
    <li>Simulation figures: seed 42, engine in this repository (Practice Lab), not a forecast.</li>
    <li>UN Sustainable Development Goals 8, 9 and 16. sdgs.un.org/goals</li>
  </ol>
</div></section>
"""

# ------------------------------------------------------------------ legal pages
NOTE = '<div class="draft"><b>Draft for the Oxro Labs pilot.</b> This document explains how the service works in plain language. It is not legal advice. Have a qualified lawyer review it, and fill the highlighted items, before wider commercial release.</div>'
CONTACT = f'<p><b>{CO}</b>, {FILL("registered address")}<br>Grievance Officer: {FILL("name")}, {FILL("email address")}</p>'


def legal(slug, title, intro, sections):
    toc = ''.join(f'<a href="#s{i}">{i + 1}. {html.escape(h)}</a>' for i, (h, _) in enumerate(sections))
    body = ''.join(f'<h2 id="s{i}">{i + 1}. {html.escape(h)}</h2>{b}' for i, (h, b) in enumerate(sections))
    return page(f'{title} · {CO} Finance Desk', intro, f"""<section class="legal"><div class="wrap">
  <aside class="toc" aria-label="On this page"><b>On this page</b>{toc}</aside>
  <article class="prose"><h1>{title}</h1><p class="meta">Last updated {UPDATED}</p>{NOTE}<p>{intro}</p>{body}{CONTACT}</article>
</div></section>""", base='../')


TERMS = [
    ('About the service', f'<p>{CO} Finance Desk (“the Service”, by Mind Your Funds) is a web application for recording invoices, bills, payroll and expenses, estimating GST, tracking compliance dates, and encouraging good financial habits. It also includes a Practice Lab, a simulation for learning.</p>'),
    ('Who may use it', '<p>You must be at least 18 and authorised to act for your business or team. A workspace administrator invites members and is responsible for who has access and which role they hold (admin, finance or viewer). Keep your sign-in details secure and tell us promptly if you suspect misuse.</p>'),
    ('Your data and content', '<p>You own the business data you enter. You give us permission to store and process it only to provide the Service, including generating reports, alerts, audit records and optional AI answers. You are responsible for the accuracy and lawfulness of what you enter, including personal data of your customers, vendors and staff.</p>'),
    ('Estimates are not advice', '<p>GST amounts, due dates, interest and health scores are planning estimates built on simplified rules. They are not tax, legal, accounting or financial advice. Confirm figures with a Chartered Accountant before filing or paying. See the <a href="disclaimer.html">Disclaimer</a>.</p>'),
    ('AI features', '<p>The AI CFO and AI wording use a third-party language model and receive aggregate figures only. Output can be wrong or incomplete. You must review it before relying on it, and it never changes your records on its own.</p>'),
    ('Acceptable use', '<ul><li>Do not use the Service for unlawful activity, money laundering or fraud.</li><li>Do not attempt to bypass roles, approvals, security controls or rate limits, or to tamper with the audit trail.</li><li>Do not upload malware or content that infringes others&rsquo; rights.</li><li>Do not misuse points, badges or the leaderboard, for example by scripting actions to earn XP.</li></ul>'),
    ('Roles, approvals and the audit trail', '<p>Approvals and permissions are enforced by the system, and actions are recorded with who did them and why. Records are designed to be tamper-evident, not tamper-proof. You must not rely on them as a legal certification.</p>'),
    ('Availability and changes', '<p>The Service is offered as a pilot, “as available”, without a service-level commitment. We may change, suspend or discontinue features. We will try to give notice of material changes.</p>'),
    ('Fees', '<p>The Service is free during the pilot. If we introduce fees we will give notice and you may stop using the Service before they apply.</p>'),
    ('Suspension and termination', '<p>You may stop using the Service at any time and export your data. We may suspend access for breach of these terms or to protect the Service or other users. On termination we will delete or anonymise your data as described in the <a href="privacy.html">Privacy Notice</a>, subject to legal retention duties.</p>'),
    ('Intellectual property', f'<p>The Service, its design and software are owned by {CO} and its licensors. You receive a limited, non-exclusive, non-transferable right to use it. Third-party components remain under their own licences.</p>'),
    ('Warranties and liability', '<p>To the extent permitted by Indian law, the Service is provided “as is” without warranties of accuracy, fitness for a particular purpose or uninterrupted operation. To the same extent, we are not liable for indirect or consequential loss, lost profit, penalties or interest arising from reliance on estimates, and our total liability is limited to the fees you paid in the previous 12 months (nil during the pilot). Nothing here excludes liability that cannot lawfully be excluded.</p>'),
    ('Governing law', f'<p>These terms are governed by the laws of India. Courts at {FILL("city")} have exclusive jurisdiction, subject to any mandatory consumer or dispute-resolution rights you have.</p>'),
    ('Changes to these terms', '<p>We may update these terms. The “last updated” date shows the current version. If you keep using the Service after a change, you accept the update. For material changes we will ask you to accept again.</p>'),
]

PRIVACY = [
    ('Who we are', f'<p>{CO} is the data fiduciary for the Service. For data your organisation enters about its customers, vendors and staff, your organisation decides what to collect, and we process it for you.</p>'),
    ('What we collect', '<ul><li><b>Account:</b> email address, display name, role, the time you accepted the Terms, and sign-in records.</li><li><b>Business data you enter:</b> transactions, party names, GSTINs, emails and phone numbers, filings, recurring entries, company profile and goals.</li><li><b>Activity:</b> audit records (who, what, why, a hash), XP, streaks, badges and leaderboard nickname.</li><li><b>Technical:</b> items kept in your browser storage (see below). We do not use advertising or tracking cookies.</li></ul>'),
    ('Why we use it', '<ul><li>To run the Service: store records, calculate GST estimates, raise alerts, produce reports and invoices.</li><li>To keep the workspace secure and auditable.</li><li>To provide rewards, streaks and the team leaderboard (you can opt out of the leaderboard).</li><li>To answer optional AI questions using aggregate figures only.</li></ul><p>We process personal data on the basis of your consent and for the lawful purposes described, in line with the principles of the Digital Personal Data Protection Act, 2023: notice, purpose limitation, data minimisation, accuracy, storage limitation and security.</p>'),
    ('Who we share it with', '<p>We use service providers (processors) that act on our instructions:</p><ul><li><b>Supabase</b>: database, authentication and real-time sync.</li><li><b>Netlify</b>: web hosting and a serverless function.</li><li><b>Groq</b>: language-model API for the AI CFO. It receives aggregate numbers only, never names or GSTINs.</li></ul><p>We do not sell personal data. We may disclose data if the law requires it. Within your workspace, access depends on role: admins can see the company-wide audit trail.</p>'),
    ('Where it is stored and how long', f'<p>Data is stored in your workspace&rsquo;s Supabase project in {FILL("region, e.g. ap-south-1 Mumbai")}. Some providers may process data outside India. We keep data while your workspace is active and delete or anonymise it within {FILL("e.g. 90")} days after you close it, unless the law requires longer retention. Audit records are kept for the life of the workspace.</p>'),
    ('Security', '<p>We use row-level security so each organisation sees only its own data, role checks enforced in the database, encrypted connections, an email-domain lock and invite codes, no secrets in the browser, and a SHA-256 hash-chained audit log. No system is perfectly secure. If a personal-data breach affects you we will notify you and the authorities as the law requires.</p>'),
    ('Your rights', '<ul><li>Access a summary of your personal data and the processing.</li><li>Correct or update inaccurate or incomplete data.</li><li>Erase data you no longer wish us to hold, where no legal duty to keep it applies.</li><li>Withdraw consent at any time (this does not affect past processing).</li><li>Nominate someone to exercise your rights if you die or become unable to.</li><li>Raise a grievance with our Grievance Officer, and if unresolved, approach the Data Protection Board of India.</li></ul><p>Settings let you export your transactions and audit trail. For other requests contact the Grievance Officer below.</p>'),
    ('Browser storage we use', '<ul><li><code>myf-theme</code>, <code>myf-fs</code>, <code>myf-contrast</code>, <code>oxro_nav_collapsed</code>, <code>myf-mute</code>: your display preferences.</li><li><code>myf-notice</code>: remembers you saw the storage notice.</li><li>Supabase session keys: keep you signed in.</li><li><code>myf-demo-data</code>: demo-mode data, stored only on your device.</li></ul>'),
    ('Children', '<p>The Service is for business use by adults. It is not directed at children, and we do not knowingly collect their personal data.</p>'),
    ('Changes', '<p>We will update this notice when our practices change and show the date above. For material changes we will ask for your consent again.</p>'),
]

DISCLAIMER = [
    ('Not professional advice', '<p>Finance Desk gives information and planning estimates. It is not tax, legal, accounting, audit or investment advice, and using it does not create an advisory relationship. Consult a Chartered Accountant or qualified professional before you file returns, pay tax or make financial decisions.</p>'),
    ('GST and compliance figures', '<p>Rates, due dates (for example GSTR-1 on the 11th and GSTR-3B on the 20th), input-credit netting and interest are simplified and may not reflect extensions, exemptions, composition schemes, state-specific rules, e-invoicing thresholds or recent notifications. They are editable planning values, not an official calculation.</p>'),
    ('Alerts and fraud checks', '<p>Alerts such as overdue invoices, duplicates, invalid GSTINs and unusually large bills are rule-based signals. They can miss real problems and raise false alarms. Always verify a supplier, bank account or payment independently.</p>'),
    ('AI-generated content', '<p>AI answers and wording can be inaccurate or out of date. They use aggregate figures only and never act on your records. Review everything before relying on it.</p>'),
    ('Simulation and statistics', '<p>The Practice Lab is a simulation with fictional data. Its results (for example a health score of 84 with the crew against 37 without) come from one scenario and are not a prediction. Public statistics shown on our pages are cited to their sources and may be updated by those sources.</p>'),
    ('Audit trail', '<p>The hash-chained audit log is tamper-evident: changing past entries breaks the chain. It is not a blockchain and not a legal certification of your records.</p>'),
    ('No guarantee', '<p>We make no guarantee that the Service is error-free or that using it will prevent penalties, losses or fraud. You remain responsible for your filings, payments and decisions.</p>'),
]

ACCESS = [
    ('Our commitment', '<p>We want Finance Desk to be usable by as many people as possible, including people who use keyboards, screen readers, magnification or have low vision, colour-vision differences or motion sensitivity. We aim to meet WCAG 2.2 level AA. This is a goal, and we have not yet completed an independent audit.</p>'),
    ('What is built in', '<ul><li><b>Light, dark and automatic themes</b>, switchable in the top bar and Settings.</li><li><b>Text size</b> (normal, large, extra large) and a <b>high-contrast</b> mode in Settings → Appearance &amp; accessibility.</li><li><b>Keyboard use</b>: a “Skip to main content” link, visible focus outlines, and dialogs that close with Esc.</li><li><b>Reduced motion</b>: confetti, tilt, count-up and shimmer are turned off when your device asks for reduced motion.</li><li><b>Responsive layout</b> for phones, tablets and desktops, with a bottom navigation bar on small screens.</li><li><b>Not colour alone</b>: statuses use words and icons as well as colour.</li><li>Status messages and toasts are announced to assistive technology.</li></ul>'),
    ('Known limitations', '<ul><li>Some charts and animated visuals offer limited text alternatives. Data is also available in tables and CSV exports.</li><li>The Practice Lab canvas scene is decorative and not fully keyboard-accessible.</li><li>The interface is currently in English only.</li></ul>'),
    ('Tell us about a barrier', '<p>If something is hard to use, contact us and we will try to fix it or offer another way to get the same information.</p>'),
]

out = {
    'welcome.html': page(f'{CO} Finance Desk · Know your cash, GST and risks every day', 'Finance desk for small businesses and teams: invoices, GST, approvals, alerts and a habit loop that keeps books current.', LANDING),
    'legal/terms.html': legal('terms', 'Terms of Service', f'These terms govern your use of the {CO} Finance Desk. Using the Service means you accept them.', TERMS),
    'legal/privacy.html': legal('privacy', 'Privacy Notice', 'How the Finance Desk collects, uses, shares and protects personal data, in plain language.', PRIVACY),
    'legal/disclaimer.html': legal('disclaimer', 'Disclaimer', 'Important limits on what the Finance Desk can and cannot do.', DISCLAIMER),
    'legal/accessibility.html': legal('accessibility', 'Accessibility Statement', 'How we are making the Finance Desk usable for everyone.', ACCESS),
}
os.makedirs(os.path.join(ROOT, 'legal'), exist_ok=True)
for name, content in out.items():
    open(os.path.join(ROOT, name), 'w', encoding='utf8').write(content)
print('wrote', ', '.join(out))
