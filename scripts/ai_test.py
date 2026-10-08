"""AI CFO end to end with the REAL Groq proxy and the real company numbers. Needs GROQ_API_KEY in .env (skips otherwise).
Run: python scripts/ai_test.py -> AI OK or the failing steps."""
import subprocess, sys, os, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if 'GROQ_API_KEY=' not in open(os.path.join(ROOT, '.env'), encoding='utf8').read() or not any(l.startswith('GROQ_API_KEY=') and len(l) > 20 for l in open(os.path.join(ROOT, '.env'), encoding='utf8').read().splitlines()):
    print('AI SKIPPED: no GROQ_API_KEY in .env'); sys.exit(0)
srv = subprocess.Popen(['node', os.path.join(ROOT, 'scripts', 'ai_server.mjs'), '3138'], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True); srv.stdout.readline()
fails = []
def check(name, cond):
    if not cond: fails.append(name)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge'); ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, service_workers='block'); ctx.add_init_script("localStorage.setItem('myf-notice','1')")
        pg = ctx.new_page(); posts = []; replies = []
        pg.on('request', lambda r: posts.append(r.post_data) if r.url.endswith('/api/groq') else None)
        pg.on('response', lambda r: replies.append((r.status, r.url)) if r.url.endswith('/api/groq') else None)
        pg.on('dialog', lambda d: d.accept()); pg.goto('http://localhost:3138/index.html'); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click(); pg.wait_for_timeout(900)
        pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(500); pg.get_by_role('button', name='Load sample data').click(); pg.wait_for_timeout(4500)
        pg.evaluate("location.hash='insights'"); pg.wait_for_timeout(700)
        pg.get_by_role('button', name='Explain my month').click()
        pg.wait_for_function("document.querySelector('.msg.ai') && document.querySelector('.msg.ai').textContent.trim() !== '…'", timeout=30000)
        ans = pg.locator('.msg.ai').last.inner_text()
        check('the proxy answered 200 (no 404)', replies and all(s == 200 for s, _ in replies))
        check('a real model answered, not the offline fallback', len(ans) > 40 and 'offline' not in ans.lower() and 'Rule of thumb' not in ans)
        body = json.loads(posts[-1]); user = [m for m in body['messages'] if m['role'] == 'user'][0]['content']
        check('prompt carries real company numbers', 'Cash ₹' in user and 'open invoices' in user and '60-day cash forecast' in user and 'GST payable this month' in user and 'health score' in user)
        check('prompt has no names or GSTINs', not any(n in user for n in ['Sharma', 'Bluebird', 'Kaveri', 'Apex', 'Metro Packaging', 'CloudBooks']) and 'GSTIN' not in user.replace('GST', '') and len(user) < 1500)
        pg.get_by_placeholder('Ask anything').fill('Can I afford a new hire next month?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        pg.wait_for_function("document.querySelectorAll('.msg.ai').length >= 2 && document.querySelectorAll('.msg.ai')[1].textContent.trim() !== '…'", timeout=30000)
        check('a free-text question is answered too', len(pg.locator('.msg.ai').nth(1).inner_text()) > 30)
        print('answer:', ans[:160].replace('\n', ' '))
        b.close()
finally:
    srv.terminate()
print('AI OK' if not fails else 'AI FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
