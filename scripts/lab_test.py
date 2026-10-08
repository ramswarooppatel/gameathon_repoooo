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
        # ---- Previous Day: one-step rewind from deep snapshots of both games
        pg.goto('http://localhost:3136/lab.html'); pg.wait_for_selector('#begin'); pg.click('#begin'); pg.wait_for_timeout(400)
        def cap():
            t = lambda sel: pg.locator(sel).inner_text()
            return dict(day=t('#h-day'), cash=t('#h-cash'), run=t('#h-run'), health=t('#h-health'), ghost=t('#h-ghealth'), react=t('#h-react'), gst=t('#h-gst') + t('#gst'), cards=t('#cards'), xp=t('#rk-xp'), missions=t('#missions'), gbar=pg.evaluate("document.getElementById('b-ghost').style.width"))
        check('Previous Day is disabled on day 0', pg.locator('#prev').is_disabled() and pg.locator('#prev').inner_text().strip() == 'Previous Day' and 'pri' not in (pg.locator('#prev').get_attribute('class') or '') and 'pri' in pg.locator('#next').get_attribute('class'))
        pg.click('#next'); pg.wait_for_timeout(60)
        check('enabled after day 1', not pg.locator('#prev').is_disabled() and pg.text_content('#h-day') == '1')
        pg.click('#prev'); pg.wait_for_timeout(100)
        check('back to day 0 and disabled again', pg.text_content('#h-day') == '0' and pg.locator('#prev').is_disabled() and pg.text_content('#h-cash').strip() == '₹1,50,000')
        for _ in range(10): pg.click('#next'); pg.wait_for_timeout(40)
        check('collector card open on day 10', pg.locator('.card:has-text("will pay")').count() == 1)
        pg.locator('.card:has-text("will pay") button.opt.rec').first.click(); pg.wait_for_timeout(200)       # a decision made on day 10, before Next day
        s10 = cap(); log10 = pg.locator('#log li').count()
        pg.click('#next'); pg.wait_for_timeout(80); s11 = cap()
        check('day 11 differs from day 10', s11['day'] == '11' and s11['cash'] != s10['cash'])
        pg.click('#prev'); pg.wait_for_timeout(120); back = cap()
        check('Previous Day restores day 10 exactly (cash, health, GST, cards, ghost, XP, missions)', back == s10)
        check('the ledger stays append-only', pg.locator('#log li').count() >= log10 and pg.locator('#impact').is_hidden())
        pg.click('#next'); pg.wait_for_timeout(80); again = cap()
        check('advancing again replays day 11 identically (random generator restored)', again == s11)
        for _ in range(3): pg.click('#next'); pg.wait_for_timeout(50)
        s14 = cap()
        for _ in range(3): pg.click('#prev'); pg.wait_for_timeout(80)
        check('three Previous Day clicks return to day 11', cap() == s11 and not pg.locator('#prev').is_disabled())
        for _ in range(3): pg.click('#next'); pg.wait_for_timeout(50)
        check('and the run continues to the same day 14', cap() == s14)
        pg.click('#auto'); pg.wait_for_timeout(250); pg.click('#prev'); pg.wait_for_timeout(100)
        check('rewind pauses Auto-play', pg.locator('#auto').inner_text() == 'Auto-play')
        # ---- New run shows the Start overlay first; nothing is reset until Start quarter
        for _ in range(3): pg.click('#next'); pg.wait_for_timeout(40)
        day_before, health_before, ghost_before = pg.text_content('#h-day'), pg.text_content('#h-health'), pg.text_content('#h-ghealth'); log_before = pg.locator('#log li').count()
        pg.click('#auto'); pg.wait_for_timeout(200); pg.click('#restart'); pg.wait_for_timeout(300)
        check('New run shows the Start overlay', pg.locator('#start').is_visible() and pg.locator('#start .modal h2').inner_text().startswith('Run the business'))
        check('New run pauses Auto-play', pg.locator('#auto').inner_text() == 'Auto-play')
        day_now = pg.text_content('#h-day')
        pg.wait_for_timeout(900); check('and the run behind it did not advance or reset', pg.text_content('#h-day') == day_now and int(day_now) >= int(day_before) and pg.locator('#log li').count() >= log_before)
        pg.locator('#start button.go-back').click(); pg.wait_for_timeout(200)
        check('Go Back from New run closes the overlay and keeps the current run', pg.locator('#start').is_hidden() and pg.text_content('#h-day') == day_now and not pg.locator('#prev').is_disabled() and pg.url.endswith('lab.html'))
        pg.click('#restart'); pg.wait_for_timeout(200); pg.fill('#nick', 'Asha'); pg.fill('#seed', '7')
        check('name and seed inputs work', pg.input_value('#nick') == 'Asha' and pg.input_value('#seed') == '7')
        pg.click('#begin'); pg.wait_for_timeout(600)
        check('Start quarter begins a fresh run: day 0, ghost reset, no history, no impact, no cards, empty ledger', pg.text_content('#h-day') == '0' and pg.text_content('#h-ghealth') == '100' and pg.text_content('#h-health') == '100' and pg.locator('#prev').is_disabled() and pg.locator('#impact').is_hidden() and pg.locator('.card').count() == 0 and pg.locator('#log li').count() == 0 and pg.locator('#start').is_hidden())
        pg.click('#next'); pg.wait_for_timeout(60); pg.click('#prev'); pg.wait_for_timeout(60)
        check('no history left over from the previous run', pg.locator('#prev').is_disabled() and pg.text_content('#h-day') == '0')
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
        pg.click('#end-new'); pg.wait_for_timeout(300)
        check('New run on the result popup opens the Start overlay', pg.locator('#end').is_hidden() and pg.locator('#start').is_visible())
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
