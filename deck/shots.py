import subprocess, time, sys, os
from playwright.sync_api import sync_playwright

root = r'D:\Codes\projects\FINGHODA'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3111', '--directory', root], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
out = os.path.join(root, 'deck', 'shots'); os.makedirs(out, exist_ok=True)
URL = 'http://localhost:3111/index.html'
def demo(pg):
    b = pg.get_by_role('button', name='Continue in demo mode')
    if b.count() and b.first.is_visible(): b.first.click(); pg.wait_for_timeout(1200)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        ctx = b.new_context(viewport={'width': 1600, 'height': 900}, device_scale_factor=2, service_workers='block')
        pg = ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(1200)
        pg.get_by_role('button', name='Continue in demo mode').click(); pg.wait_for_timeout(1200)
        pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(500)
        pg.fill('#s-name', 'Oxro Labs'); pg.fill('#s-gstin', '27AABCF1234F1Z4'); pg.fill('#s-goal', '250000')
        pg.evaluate("document.getElementById('s-goal').form.requestSubmit()"); pg.wait_for_timeout(900)
        pg.get_by_role('button', name='Load sample data').click(); pg.wait_for_timeout(5000)
        # finance user creates a big spend -> pending, then admin view
        pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('myf-demo-data'));d.role='finance';localStorage.setItem('myf-demo-data',JSON.stringify(d));})()")
        pg.reload(); pg.wait_for_timeout(1200); demo(pg)
        pg.evaluate("location.hash='transactions'"); pg.wait_for_timeout(500)
        pg.get_by_role('button', name='+ Add transaction').click(); pg.wait_for_timeout(300)
        pg.select_option('#e-kind', 'purchase'); pg.fill('#e-party', 'Apex Machinery'); pg.fill('#e-num', 'B-92'); pg.fill('#e-taxable', '80000')
        pg.evaluate("document.querySelector('dialog form').requestSubmit()"); pg.wait_for_timeout(1500)
        pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('myf-demo-data'));d.role='admin';localStorage.setItem('myf-demo-data',JSON.stringify(d));})()")
        pg.reload(); pg.wait_for_timeout(1200); demo(pg); pg.wait_for_timeout(800)
        for name in ['dashboard', 'transactions', 'approvals', 'compliance', 'reports', 'rewards', 'audit', 'team', 'parties', 'insights']:
            pg.evaluate(f"location.hash='{name}'"); pg.wait_for_timeout(2200)
            pg.screenshot(path=os.path.join(out, f'{name}.png'))
        pg.evaluate("location.hash='dashboard'"); pg.wait_for_timeout(1500)
        pg.evaluate("window.scrollTo(0, 700)"); pg.wait_for_timeout(600)
        pg.screenshot(path=os.path.join(out, 'dashboard2.png'))
        print('console errors:', errs[:5])
        b.close()
finally:
    srv.terminate()
print(sorted(os.listdir(out)))
