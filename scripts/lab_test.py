"""Practice Lab coach: story on cards, correct Recommended label, real decision impact, lesson link, Ghost Twin end screen.
Run: python scripts/lab_test.py -> LAB OK or the failing steps."""
import subprocess, sys, os, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3136', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond):
    if not cond: fails.append(name)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge'); ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, service_workers='block')
        ctx.add_init_script("localStorage.setItem('myf-notice','1')")
        pg = ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:3136/lab.html'); pg.wait_for_selector('#begin'); pg.click('#begin'); pg.wait_for_timeout(500)
        def step_until(sel, limit=60):
            for _ in range(limit):
                if pg.locator(sel).count(): return True
                pg.click('#next'); pg.wait_for_timeout(60)
            return False
        # ---- day 10: late payment card
        check('late payment card arrives', step_until('.card:has-text("will pay")'))
        card = pg.locator('.card', has_text='will pay').first
        txt = card.inner_text()
        check('story sections', "WHAT'S HAPPENING?" in txt.upper() and 'WHY DOES IT MATTER?' in txt.upper() and 'is now expected to pay' in txt)
        check('skill line and recommendation reason', 'Receivables and payment timing' in txt and 'RECOMMENDED' in txt.upper() and 'at no cost' in txt)
        check('only the first option is Recommended', card.locator('button.opt').count() == 3 and card.locator('button.opt.rec').count() == 1 and 'Recommended' in card.locator('button.opt').first.inner_text() and 'Recommended' not in card.locator('button.opt').nth(1).inner_text())
        check('if you do nothing line uses defaultOption', 'If you do not decide in' in txt and txt.strip().splitlines()[-1].endswith('Wait.'))
        card.locator('button.opt').first.click(); pg.wait_for_timeout(300)
        imp = pg.locator('#impact').inner_text()
        check('impact from engine state', 'DECISION IMPACT' in imp.upper() and 'days earlier' in imp and 'Business health' in imp)
        check('learned + existing lesson link', 'Plan around when money moves' in imp and 'Profit is not cash' in imp and pg.locator('#impact a.btn').get_attribute('href') == 'index.html#learn')
        pg.wait_for_timeout(3000); pg.click('#next'); pg.wait_for_timeout(100); pg.click('#next'); pg.wait_for_timeout(300)
        check('impact stays visible after the decision (3s and two more days)', pg.locator('#impact').is_visible() and 'DECISION IMPACT' in pg.locator('#impact').inner_text().upper() and 'Profit is not cash' in pg.locator('#impact').inner_text())
        check('ghost twin still advances', int(pg.text_content('#h-day')) >= 10 and pg.text_content('#h-ghealth').strip().isdigit())
        # ---- fraud card: Pay anyway must never be labelled Recommended
        check('fraud card arrives', step_until('.card:has-text("Suspicious bill")'))
        fc = pg.locator('.card', has_text='Suspicious bill').first; ft = fc.inner_text()
        opts = fc.locator('button.opt'); check('block is recommended, pay anyway is not', 'Recommended' in opts.first.inner_text() and 'Block' in opts.first.inner_text() and 'Recommended' not in opts.nth(1).inner_text())
        check('default shows the dangerous outcome', 'If you do not decide in' in ft and 'Pay anyway' in ft.strip().splitlines()[-1])
        check('fraud story', 'Red flags' in ft and 'Spot' not in ft)
        opts.first.click(); pg.wait_for_timeout(300); imp = pg.locator('#impact').inner_text()
        check('fraud impact + lesson', 'fraudulent payment blocked' in imp and 'Spot payment fraud' in imp and 'Verify bank-detail changes' in imp)
        # lesson CTA remembers the lesson and opens Learn
        with pg.expect_navigation(): pg.locator('#impact a.btn').click()
        check('Learn page opens, lesson remembered', pg.url.endswith('index.html#learn') and pg.evaluate("localStorage.getItem('myf-suggest-lesson')") == 'fraud')
        # ---- a new decision must not sit under the previous read-out
        pg.goto('http://localhost:3136/lab.html'); pg.wait_for_selector('#begin'); pg.click('#begin'); pg.wait_for_timeout(400)
        seen_timeout = False
        for _ in range(40):
            if pg.locator('.card:has-text("Suspicious bill")').count(): break
            pg.click('#next'); pg.wait_for_timeout(30)
            if pg.locator('#impact:not([hidden])', has_text='No decision in time').count(): seen_timeout = True
        check('earlier timeouts were shown while nothing else was open', seen_timeout)
        check('fraud card open: previous impact is cleared', pg.locator('.card:has-text("Suspicious bill")').count() == 1 and not pg.locator('#impact').is_visible())
        pg.locator('.card:has-text("Suspicious bill") button.opt').first.click(); pg.wait_for_timeout(300)
        check('then its own impact appears', 'fraudulent payment blocked' in pg.locator('#impact').inner_text() and 'No decision in time' not in pg.locator('#impact').inner_text())
        # ---- play on without answering anything: timeouts show the default consequence, then finish the quarter
        pg.goto('http://localhost:3136/lab.html'); pg.wait_for_selector('#begin'); pg.click('#begin'); pg.wait_for_timeout(400)
        saw_timeout = False
        for _ in range(95):
            if pg.locator('#end:not([hidden])').count(): break
            pg.click('#next'); pg.wait_for_timeout(25)
            if pg.locator('#impact:not([hidden])', has_text='No decision in time').count(): saw_timeout = True
        check('unanswered card explains the default', saw_timeout)
        pg.wait_for_selector('#end:not([hidden])', timeout=8000)
        cmp = pg.locator('#compare').inner_text()
        check('ghost twin reveal', 'SAME BUSINESS' in cmp.upper() and 'YOUR BUSINESS' in cmp.upper() and 'UNASSISTED TWIN' in cmp.upper() and 'Health' in cmp and ('FinCrew helped' in cmp or 'twin' in cmp))
        # ---- a full run where the owner follows every recommendation beats the twin
        pg.goto('http://localhost:3136/lab.html'); pg.wait_for_selector('#begin'); pg.click('#begin'); pg.wait_for_timeout(400)
        for _ in range(95):
            if pg.locator('#end:not([hidden])').count(): break
            while pg.locator('.card button.opt.rec').count(): pg.locator('.card button.opt.rec').first.click(); pg.wait_for_timeout(15)
            pg.click('#next'); pg.wait_for_timeout(15)
        pg.wait_for_selector('#end:not([hidden])', timeout=8000); cmp = pg.locator('#compare').inner_text()
        check('following the crew wins', 'FinCrew helped you finish' in cmp)
        check('no console errors', not errs)
        if errs: print(errs[:3])
        b.close()
finally:
    srv.terminate()
print('LAB OK' if not fails else 'LAB FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
