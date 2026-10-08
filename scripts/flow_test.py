"""End-to-end check of the guided workflow in demo mode. Run: python scripts/flow_test.py  -> prints FLOW OK or the failing step."""
import subprocess, sys, os, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3128', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond): 
    if not cond: fails.append(name)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge'); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block')
        ctx.add_init_script("localStorage.setItem('myf-notice','1'); localStorage.setItem('myf-theme','dark');")
        pg = ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'status of 501' not in m.text else None)   # a static test server has no /api/groq (POST 501): the app falls back, which is expected here; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: d.dismiss()); ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://localhost:3128')
        pg.goto('http://localhost:3128/index.html'); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click()
        pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached'); pg.wait_for_timeout(800)
        check('lands on Today', 'Today' in (pg.text_content('main h2') or ''))
        pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(500); pg.get_by_role('button', name='Load sample data').click(timeout=15000); pg.wait_for_timeout(4500)
        pg.evaluate("location.hash='today'"); pg.wait_for_timeout(900)
        check('5 daily steps', pg.locator('.wf-step').count() == 5)
        xp0 = int(pg.text_content('#lv-xp').split()[0])
        # collect step: send a reminder
        pg.get_by_role('button', name='Send reminder').first.click(); pg.wait_for_timeout(900)
        check('reminder marks step done or sent', pg.locator('text=Sent today').count() >= 1)
        # record step: nothing to record
        pg.get_by_role('button', name='Nothing to record today').click(); pg.wait_for_timeout(800)
        check('xp went up', int(pg.text_content('#lv-xp').split()[0]) > xp0)
        # monthly close: tick a manual item and see it persist across reload of view
        pg.get_by_role('tab', name='Month-end close').click(); pg.wait_for_timeout(500)
        before = pg.locator('.wf-check input:checked').count()
        pg.locator('.wf-check input:not(:checked):not(:disabled)').first.click(); pg.wait_for_timeout(1200)
        check('tick persisted', pg.locator('.wf-check input:checked').count() == before + 1)
        # planner: slider what-if + budget save
        pg.evaluate("location.hash='planner'"); pg.wait_for_timeout(700)
        check('forecast chart', pg.locator('.fc-chart').count() == 1)
        pg.locator('input[type=range]').fill('20'); pg.wait_for_timeout(500)
        check('what-if row', pg.locator('text=+20 days').count() >= 1)
        pg.locator('input[aria-label$="monthly budget"]').first.fill('5000'); pg.get_by_role('button', name='Save budgets').click(); pg.wait_for_timeout(900)
        check('budget bar', pg.locator('.bar.over, .bar.watch, .bar.ok').count() >= 1)
        # learn: pass lesson 1
        pg.evaluate("location.hash='learn'"); pg.wait_for_timeout(600); pg.get_by_role('button', name='Start').first.click(); pg.wait_for_timeout(400)
        for q, a in enumerate([0, 1, 1]): pg.locator(f'input[name="q{q}"][value="{a}"]').check()
        xp1 = int(pg.text_content('#lv-xp').split()[0]); pg.get_by_role('button', name='Check answers').click(); pg.wait_for_timeout(2200)
        check('lesson xp', int(pg.text_content('#lv-xp').split()[0]) >= xp1 + 25)
        check('lesson marked complete', pg.locator('.lesson.is-done').count() == 1)
        # palette
        pg.keyboard.press('Control+k'); pg.wait_for_selector('.pal-input'); pg.keyboard.type('report'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
        check('palette navigates', 'Reports' in (pg.text_content('main h2') or ''))
        # theme toggle persists
        pg.locator('[data-theme-toggle]').first.click(); check('theme toggled', pg.evaluate("document.documentElement.dataset.theme") == 'light')
        # real keystrokes must reach the AI CFO box (an on* handler that returned false once swallowed every key)
        pg.evaluate("location.hash='insights'"); pg.wait_for_timeout(500)
        box = pg.get_by_placeholder('Ask anything'); box.click(); pg.keyboard.type('Can I afford a hire?', delay=15)
        check('typing works in the AI CFO box', box.input_value() == 'Can I afford a hire?')
        pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
        check('Enter sends it and clears the box', box.input_value() == '' and pg.locator('.msg.me', has_text='Can I afford a hire?').count() == 1)
        check('no console errors', not errs)
        if errs: print('console:', sorted(set(errs))[:3])
        b.close()
finally: srv.terminate()
print('FLOW OK' if not fails else 'FLOW FAILED: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
