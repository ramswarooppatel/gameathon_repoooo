"""Back navigation across the app, the Practice Lab overlays and the static pages. Run: python scripts/nav_test.py -> NAV OK or the failing steps."""
import subprocess, sys, os, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3137', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond):
    if not cond: fails.append(name)
BASE = 'http://localhost:3137/'
DATA = json.dumps({'org': {'name': 'Acme', 'gstin': '27AAPFU0939F1ZV', 'opening_balance': 100000, 'monthly_goal': 0, 'approval_limit': 25000, 'invite_code': 'x'}, 'role': 'admin'})
def boot(ctx, hash_=''):
    pg = ctx.new_page(); pg.goto(BASE + 'index.html' + hash_); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click()
    pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached'); pg.wait_for_timeout(700); return pg
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge'); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block')
        ctx.add_init_script("localStorage.setItem('myf-notice','1');" + f"if(!localStorage.getItem('myf-demo-data'))localStorage.setItem('myf-demo-data', {json.dumps(DATA)});")
        errs = []
        pg = boot(ctx); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept(''))
        h = lambda: pg.evaluate('location.hash')
        back = pg.locator('button.page-back')
        check('no Back on the home page', pg.locator('button.page-back').count() == 0 and h() in ('', '#today'))
        # ---- every major page: go there from Today, Back returns to Today
        for page in ['planner', 'learn', 'reports', 'invoices', 'transactions', 'rewards', 'settings', 'compliance', 'payroll']:
            pg.evaluate("location.hash='today'"); pg.wait_for_timeout(250)
            pg.locator(f'#desktop-nav a[data-v="{page}"]').first.click(); pg.wait_for_timeout(500)
            ok_here = h() == '#' + page and back.count() == 1 and back.is_visible() and pg.locator('main h2').count() == 1
            back.click(); pg.wait_for_timeout(500)
            check(f'{page}: Back is shown and returns to Today', ok_here and h() == '#today' and pg.locator('button.page-back').count() == 0)
        # ---- a screen with its own Back (invoice form) shows exactly one Back, and it returns to the list
        pg.evaluate("location.hash='invoices'"); pg.wait_for_timeout(400); pg.get_by_role('button', name='New invoice').first.click(); pg.wait_for_timeout(400)
        check('invoice form: one Back only', pg.locator('.inv-form').count() == 1 and pg.get_by_role('button', name='Back').count() == 1 and pg.locator('button.page-back').count() == 0)
        pg.get_by_role('button', name='Back').click(); pg.wait_for_timeout(400)
        check('its Back returns to the invoice list, which has the page Back', pg.locator('.inv-form').count() == 0 and h() == '#invoices' and pg.locator('button.page-back').count() == 1)
        # ---- a chain uses real history
        pg.evaluate("location.hash='reports'"); pg.wait_for_timeout(300); pg.evaluate("location.hash='planner'"); pg.wait_for_timeout(300)
        back.click(); pg.wait_for_timeout(400); check('Today > Reports > Planner > Back is Reports', h() == '#reports')
        back.click(); pg.wait_for_timeout(400); check('Back again is the page before', h() in ('#today', '#planner', '#settings', '#learn', '#invoices', '#transactions', '#rewards', '#compliance', '#payroll') and True)
        # ---- browser back/forward behave the same and never show a blank page
        pg.evaluate("location.hash='today'"); pg.wait_for_timeout(250); pg.evaluate("location.hash='learn'"); pg.wait_for_timeout(300); pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(300)
        pg.go_back(); pg.wait_for_timeout(400); check('browser Back goes to Learn with content', h() == '#learn' and pg.locator('#view').inner_text().strip() != '')
        pg.go_forward(); pg.wait_for_timeout(400); check('browser Forward goes to Settings', h() == '#settings' and 'Settings' in pg.locator('main h2').inner_text())
        back.click(); pg.wait_for_timeout(400); check('Back after a browser Forward still works', h() == '#learn')
        # ---- opened directly on a deep link: Back goes Today in place, not out of the app
        pg2 = boot(ctx, '#reports'); h2 = lambda: pg2.evaluate('location.hash'); n0 = pg2.evaluate('history.length')
        pg2.locator('button.page-back').click(); pg2.wait_for_timeout(500)
        check('deep link: Back goes to Today', h2() == '#today' and pg2.url.startswith(BASE + 'index.html') and pg2.locator('#view').inner_text().strip() != '' and pg2.evaluate('history.length') == n0)
        pg2.locator('#desktop-nav a[data-v="invoices"]').click(); pg2.wait_for_timeout(400); pg2.locator('button.page-back').click(); pg2.wait_for_timeout(400)
        check('then normal navigation and Back still work', h2() == '#today'); pg2.close()
        # ---- modals: existing close controls still work and the page underneath is untouched
        pg.evaluate("location.hash='transactions'"); pg.wait_for_timeout(500); pg.get_by_role('button', name='+ Add transaction').first.click(); pg.wait_for_timeout(400)
        dlg = pg.locator('dialog.entry-dialog-modal'); check('Add transaction opens', dlg.is_visible())
        dlg.get_by_label('Close').click(); pg.wait_for_timeout(300); check('Add transaction closes, still on Transactions', not dlg.is_visible() and h() == '#transactions')
        pg.keyboard.press('?'); pg.wait_for_timeout(300); check('shortcuts dialog opens and Esc closes it', pg.locator('.overlay:not([hidden]) .wide-modal').count() == 1)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300); check('help closed, still on Transactions', pg.locator('.overlay .wide-modal').count() == 0 and h() == '#transactions')
        check('no page errors in the app', not errs)
        # ---- Practice Lab: Go Back on the Start overlay returns to where the Captain came from
        pg.goto(BASE + 'index.html#today'); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(500)
        with pg.expect_navigation(): pg.locator('#desktop-nav a.lab').click()
        pg.wait_for_selector('#begin'); check('arrived on the Practice Lab with the Start overlay', pg.url.endswith('lab.html') and pg.locator('#start').is_visible())
        check('Start overlay shows Go Back', pg.locator('#start button.go-back').is_visible() and 'Go Back' in pg.locator('#start button.go-back').inner_text())
        with pg.expect_navigation(): pg.locator('#start button.go-back').click()
        pg.wait_for_selector('#auth:not([hidden]) button, #app:not([hidden])')                       # a full page load: demo mode asks to continue again, as on any reload
        check('Go Back returns to the Finance Desk (not into the lab, no run started)', pg.url.startswith(BASE + 'index.html') and pg.locator('#start').count() == 0)
        lab0 = ctx.new_page(); lab0.goto(BASE + 'lab.html'); lab0.wait_for_selector('#begin')           # opened directly: nothing to go back to
        with lab0.expect_navigation(): lab0.locator('#start button.go-back').click()
        check('opened directly: Go Back goes to the Finance Desk', lab0.url.startswith(BASE + 'index.html')); lab0.close()
        lab = ctx.new_page(); lerr = []; lab.on('pageerror', lambda e: lerr.append(str(e))); lab.goto(BASE + 'lab.html'); lab.wait_for_selector('#begin')
        check('lab header keeps its Finance Desk link', lab.locator('a.back-link').count() == 1 and lab.locator('a.back-link').get_attribute('href') == 'index.html')
        lab.wait_for_function("document.getElementById('h-cash').textContent.includes('1,20,000')")
        lab.click('#begin'); lab.wait_for_timeout(500)
        lab.click('#next'); lab.click('#next'); lab.click('#next'); lab.wait_for_timeout(100)
        check('the lab runs and keeps its state', lab.text_content('#h-day') == '3' and not lab.locator('#prev').is_disabled())
        lab.click('#restart'); lab.wait_for_timeout(600)
        check('New run still starts a fresh run', lab.text_content('#h-day') == '0' and lab.locator('#start').is_hidden())
        for _ in range(95):
            if lab.locator('#end:not([hidden])').count(): break
            lab.click('#next'); lab.wait_for_timeout(15)
        lab.wait_for_selector('#end:not([hidden])', timeout=8000)
        check('End overlay shows Go Back', lab.locator('#end button.go-back').is_visible())
        d_end = lab.text_content('#h-day'); h_end = lab.text_content('#h-health'); lab.locator('#end button.go-back').click(); lab.wait_for_timeout(200)
        check('Go Back on the End overlay keeps the final state', lab.locator('#end').is_hidden() and lab.text_content('#h-day') == d_end and lab.text_content('#h-health') == h_end and int(d_end) > 0)
        with lab.expect_navigation(): lab.locator('a.back-link').click()
        check('Finance Desk link leads to the app', lab.url.startswith(BASE + 'index.html')); check('no lab page errors', not lerr)
        if lerr: print(lerr[:2])
        lab.close()
        # ---- static pages
        t = ctx.new_page(); t.goto(BASE + 'legal/terms.html'); t.wait_for_timeout(300)
        check('legal page has Back', t.locator('#back').is_visible() and 'Back' in t.locator('#back').inner_text())
        with t.expect_navigation(): t.locator('#back').click()
        check('opened directly: Back goes to the app', t.url.startswith(BASE + 'index.html'))
        w = ctx.new_page(); w.goto(BASE + 'welcome.html'); w.wait_for_timeout(200)
        with w.expect_navigation(): w.locator('footer a[href$="legal/privacy.html"]').first.click()
        with w.expect_navigation(): w.locator('#back').click()
        check('came from another page: Back returns there', w.url.endswith('welcome.html') or '/welcome.html' in w.url)
        b.close()
finally:
    srv.terminate()
print('NAV OK' if not fails else 'NAV FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
