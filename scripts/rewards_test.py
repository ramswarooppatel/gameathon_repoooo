"""Navigation, compliance page and company-funded rewards in demo mode. Run: python scripts/rewards_test.py -> REWARDS OK or the failing steps."""
import subprocess, sys, os, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3132', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond):
    if not cond: fails.append(name)
DATA = json.dumps({'org': {'name': 'Acme', 'gstin': '27AAPFU0939F1ZV', 'opening_balance': 100000, 'monthly_goal': 0, 'approval_limit': 25000, 'invite_code': 'x'}, 'role': 'admin',
                   'xp_events': [{'id': 'seed', 'kind': 'seed', 'ref': '1', 'day': '2026-01-01', 'xp': 2000, 'user_id': 'me', 'created_at': '2026-01-01T00:00:00Z'}]})
try:
    tmp = os.path.join(ROOT, 'deck');
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block', accept_downloads=True)
        ctx.add_init_script("localStorage.setItem('myf-notice','1');" + f"if(!localStorage.getItem('myf-demo-data'))localStorage.setItem('myf-demo-data', {json.dumps(DATA)});")
        pg = ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: d.accept('')); pg.goto('http://localhost:3132/index.html'); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click()
        pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached'); pg.wait_for_timeout(800)
        # navigation
        check('5 nav groups, 15 links', pg.locator('#desktop-nav .nav-group').count() == 4 and pg.locator('#desktop-nav a').count() == 17)
        check('active link marked', pg.locator('#desktop-nav a[aria-current="page"]').count() == 1)
        pg.locator('#desktop-nav a[data-v="standards"]').click(); pg.wait_for_timeout(900)
        check('top bar title follows', pg.text_content('#top-page-name') == 'Compliance')
        txt = pg.locator('main').inner_text()
        check('compliance page', 'Aligned, not certified' in txt and 'ISO/IEC 27001' in txt and 'GSTR-3B' in txt and 'Your readiness' in txt)
        check('integrity check passes', pg.locator('.chk-row', has_text='Audit trail integrity').locator('i.ok').count() == 1)
        with pg.expect_download() as d: pg.get_by_role('button', name='Download evidence pack').click()
        path = os.path.join(tmp, '_ev.json'); d.value.save_as(path); ev = json.load(open(path, encoding='utf8')); os.remove(path)
        check('evidence pack', ev['audit_chain']['intact'] and ev['company'] == 'Acme' and len(ev['controls']) >= 8)
        pg.get_by_role('tab', name='Your action').click(); pg.wait_for_timeout(300)
        check('filter by status', pg.locator('.std-row .chip', has_text='Built in').count() == 0 and pg.locator('.std-row').count() >= 3)
        first = pg.locator('input[aria-label$="done"]').first; first.click(); pg.wait_for_timeout(700)
        check('duty tick saved', len(json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')")).get('checklist_ticks', [])) == 1)
        # shortcut
        pg.mouse.click(5, 5); pg.keyboard.press('g'); pg.keyboard.press('w'); pg.wait_for_timeout(500); check('g w goes to rewards', pg.evaluate('location.hash') == '#rewards')
        # rewards store
        pg.get_by_role('tab', name='Rewards store').click(); pg.wait_for_timeout(400)
        check('shows spendable XP', '2' in pg.locator('main .big').first.inner_text() and 'XP' in pg.locator('main .big').first.inner_text())
        pg.locator('input[aria-label="Monthly reward pool in rupees"]').fill('1000'); pg.get_by_role('button', name='Save pool').click(); pg.wait_for_timeout(700)
        pg.get_by_role('button', name='Team coffee').click(); pg.locator('.lesson', has_text='Team coffee').wait_for(); pg.get_by_role('button', name='Gift voucher ₹500').click(); pg.locator('.lesson', has_text='Gift voucher').wait_for()
        check('rewards created', pg.locator('.lesson', has_text='Team coffee').count() == 1 and pg.locator('.lesson', has_text='Gift voucher').count() == 1)
        pg.locator('.lesson', has_text='Team coffee').get_by_role('button', name='Redeem').click(); pg.wait_for_timeout(700)
        pg.locator('.lesson', has_text='Gift voucher').get_by_role('button', name='Redeem').click(); pg.wait_for_timeout(700)
        d0 = json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')")); red = d0['redemptions']
        check('two pending requests, terms copied from reward', len(red) == 2 and all(r['status'] == 'pending' for r in red) and sorted(r['cost_inr'] for r in red) == [300, 500])
        check('spendable XP reduced', pg.locator('main .big').first.inner_text().startswith(str(2000 + 0)) is False)
        # pool is now 800 of 1000: a second voucher (500) must be blocked
        pg.locator('.lesson', has_text='Gift voucher').locator('button', has_text='Pool used up').count()
        check('pool cap blocks overspend', pg.locator('.lesson', has_text='Gift voucher').locator('button[disabled]').count() == 1)
        # admin decides
        pg.get_by_role('button', name='Approve').first.click(); pg.wait_for_timeout(600); pg.get_by_role('button', name='Mark delivered').first.click(); pg.wait_for_timeout(600)
        pg.get_by_role('button', name='Decline').first.click(); pg.wait_for_timeout(700)
        d1 = json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')")); st = sorted(r['status'] for r in d1['redemptions'])
        check('delivered and declined', st == ['fulfilled', 'rejected'])
        check('declined request frees pool and XP', pg.locator('.lesson', has_text='Team coffee').locator('button[disabled]').count() == 0)
        pg.get_by_role('tab', name='Who pays').click(); pg.wait_for_timeout(300)
        check('funding explained', 'Your company pays' in pg.locator('main').inner_text() and 'hard cap' in pg.locator('main').inner_text())
        # phone layout
        pg.set_viewport_size({'width': 375, 'height': 800}); pg.wait_for_timeout(400)
        check('phone bar: 4 tabs + More', pg.locator('#mobile-bar .mb-tab').count() == 5)
        pg.click('#mb-more-btn'); pg.wait_for_timeout(500)
        check('More sheet is grouped', pg.locator('.drawer-sec').count() == 6 and pg.locator('.drawer-item').count() == 17)
        pg.locator('.drawer-item[data-v="standards"]').click(); pg.wait_for_timeout(700)
        check('sheet link navigates and closes', pg.evaluate('location.hash') == '#standards' and pg.locator('#mobile-drawer.open').count() == 0)
        check('no horizontal overflow on phone', pg.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0)
        check('no console errors', not errs)
        if errs: print(errs[:3])
        b.close()
finally:
    srv.terminate()
print('REWARDS OK' if not fails else 'REWARDS FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
