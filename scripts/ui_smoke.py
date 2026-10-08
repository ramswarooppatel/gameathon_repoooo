"""UI smoke test: every page x every role x 3 widths. Fails on console errors, page errors or horizontal overflow.
Run: python scripts/ui_smoke.py   (needs: pip install playwright; uses installed Microsoft Edge)"""
import subprocess, sys, os, time, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC = ['welcome.html', 'legal/terms.html', 'legal/privacy.html', 'legal/disclaimer.html', 'legal/accessibility.html']
PAGES = ['dashboard', 'transactions', 'parties', 'approvals', 'compliance', 'reports', 'insights', 'rewards', 'audit', 'team', 'settings', 'styleguide', 'today', 'planner', 'learn', 'invoices']
subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build_css.py')], check=True, stdout=subprocess.DEVNULL)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3122', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
problems = []

def demo(pg):
    pg.wait_for_selector('#auth:not([hidden]) button, #app:not([hidden])', timeout=15000)
    b = pg.get_by_role('button', name='Continue in demo mode')
    if b.count() and b.first.is_visible(): b.first.click()
    pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached', timeout=15000); pg.wait_for_timeout(500)

def set_role(pg, role):
    pg.evaluate("r => { const d = JSON.parse(localStorage.getItem('myf-demo-data') || '{}'); d.role = r; localStorage.setItem('myf-demo-data', JSON.stringify(d)); }", role)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        for theme, width, height in [('dark', 1440, 900), ('light', 1440, 900), ('light', 768, 1024), ('dark', 375, 812), ('light', 375, 812)]:
            ctx = b.new_context(viewport={'width': width, 'height': height}, service_workers='block')
            ctx.add_init_script(f"localStorage.setItem('myf-theme','{theme}');")
            pg = ctx.new_page(); errs = []
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
            pg.goto('http://localhost:3122/index.html'); pg.wait_for_timeout(900); demo(pg)
            pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(400)
            pg.get_by_role('button', name='Load sample data').click(timeout=15000); pg.wait_for_timeout(4500)
            for role in ['admin', 'finance', 'viewer']:
                set_role(pg, role); pg.reload(); pg.wait_for_timeout(700); demo(pg)
                for name in PAGES:
                    if role != 'admin' and name == 'team': continue
                    pg.evaluate(f"location.hash='{name}'"); pg.wait_for_timeout(450)
                    ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    empty = pg.evaluate("document.querySelector('#view')?.children.length || 0")
                    if ov > 2: problems.append(f'{theme} {width}px {role} #{name}: horizontal overflow {ov}px')
                    if not empty: problems.append(f'{theme} {width}px {role} #{name}: empty view')
            for name in STATIC:
                pg.goto('http://localhost:3122/' + name); pg.wait_for_timeout(500)
                if pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") > 2: problems.append(f'{theme} {width}px {name}: horizontal overflow')
                if pg.evaluate("document.documentElement.dataset.theme") != theme: problems.append(f'{theme} {width}px {name}: theme not applied')
            for e in sorted(set(errs)): problems.append(f'{theme} {width}px console: {e[:160]}')
            ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n'.join(problems) if problems else 'UI SMOKE OK'); sys.exit(1 if problems else 0)
