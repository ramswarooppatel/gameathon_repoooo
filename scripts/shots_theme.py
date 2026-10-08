"""Screenshots of every page in a given theme: python scripts/shots_theme.py light|dark [width]  -> deck/shots_<theme>_<width>/"""
import subprocess, sys, os, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
theme = sys.argv[1] if len(sys.argv) > 1 else 'light'; width = int(sys.argv[2]) if len(sys.argv) > 2 else 1440
out = os.path.join(ROOT, 'deck', f'shots_{theme}_{width}'); os.makedirs(out, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3125', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
def demo(pg):
    pg.wait_for_selector('#auth:not([hidden]) button, #app:not([hidden])', timeout=15000)
    b = pg.get_by_role('button', name='Continue in demo mode')
    if b.count() and b.first.is_visible(): b.first.click()
    pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached', timeout=15000); pg.wait_for_timeout(600)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        ctx = b.new_context(viewport={'width': width, 'height': 900 if width > 600 else 812}, service_workers='block', color_scheme='light' if theme == 'light' else 'dark')
        ctx.add_init_script(f"localStorage.setItem('myf-theme','{theme}'); localStorage.setItem('myf-notice','1');")
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:3125/index.html'); pg.screenshot(path=os.path.join(out, '00-auth.png')); demo(pg)
        pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(400)
        pg.fill('#s-name', 'Oxro Labs'); pg.fill('#s-gstin', '27AABCF1234F1Z4'); pg.fill('#s-goal', '250000')
        pg.evaluate("document.getElementById('s-goal').form.requestSubmit()"); pg.wait_for_timeout(900)
        pg.get_by_role('button', name='Load sample data').click(); pg.wait_for_timeout(5000)
        for name in ['dashboard', 'transactions', 'parties', 'approvals', 'compliance', 'reports', 'insights', 'rewards', 'audit', 'team', 'settings']:
            pg.evaluate(f"location.hash='{name}'"); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(1800)
            pg.screenshot(path=os.path.join(out, f'{name}.png'), full_page=(width > 600 and name in ('reports', 'settings')))
        print('errors:', sorted(set(errs))[:4]); b.close()
finally: srv.terminate()
print(out)
