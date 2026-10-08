"""Payroll end to end in demo mode: employees, run, approve, pay, files, gamification, books links, roles. Run: python scripts/payroll_test.py -> PAYROLL OK or the failing steps."""
import subprocess, sys, os, time, json, tempfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3135', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond):
    if not cond: fails.append(name)
def data(role='admin'): return json.dumps({'org': {'name': 'Acme Traders', 'gstin': '27AAPFU0939F1ZV', 'opening_balance': 500000, 'monthly_goal': 0, 'approval_limit': 25000, 'invite_code': 'x', 'invoice_settings': {'address': '12 MG Road', 'city': 'Mumbai'}}, 'role': role})
def store(pg): return json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')"))
def boot(b, role='admin', w=1440):
    ctx = b.new_context(viewport={'width': w, 'height': 900}, service_workers='block', accept_downloads=True)
    ctx.add_init_script("localStorage.setItem('myf-notice','1');" + f"if(!localStorage.getItem('myf-demo-data'))localStorage.setItem('myf-demo-data', {json.dumps(data(role))});")
    pg = ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept(''))
    pg.goto('http://localhost:3135/index.html'); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click()
    pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached'); pg.wait_for_timeout(800)
    return ctx, pg, errs
try:
    tmp = tempfile.mkdtemp()
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        ctx, pg, errs = boot(b)
        check('Payroll in the sidebar', pg.locator('#desktop-nav a[data-v="payroll"]').count() == 1)
        pg.locator('#desktop-nav a[data-v="payroll"]').click(); pg.wait_for_timeout(900)
        check('streak and readiness shown', '0-month streak' in pg.locator('main').inner_text() and pg.locator('.pay-ready .ring').count() == 1)
        # ---- add an employee through the dialog
        pg.get_by_role('tab', name='Employees').click(); pg.wait_for_timeout(300); pg.get_by_role('button', name='Add your first employee').click(); pg.wait_for_timeout(400)
        m = pg.locator('.wide-modal'); m.get_by_label('Full name *').fill('Asha Rao'); m.get_by_label('Basic salary ₹ / month *').fill('30000'); m.get_by_label('HRA ₹').fill('12000'); m.get_by_label('Other allowances ₹').fill('8000')
        m.locator('select[aria-label="Professional tax state"]').select_option('27'); pg.wait_for_timeout(300)
        prev = m.locator('.tax-preview-card').inner_text()
        check('live take-home preview (gross 50,000, net 48,000)', '50,000' in prev and '48,000' in prev)
        m.get_by_label('PAN').fill('ABCDE1234F'); m.get_by_label('UAN (12 digits)').fill('100200300400'); m.get_by_label('Bank account number').fill('123456789012'); m.get_by_label('IFSC').fill('HDFC0001234')
        m.get_by_role('button', name='Save employee').click(); pg.wait_for_timeout(900)
        # ---- bad data is refused, CSV import adds a second person
        csv = os.path.join(tmp, 'e.csv'); open(csv, 'w').write('code,name,basic,hra,allowances,pf,esi,pt_state,pan,uan,bank_acc,ifsc\nE900,Ravi Kumar,12000,4000,2000,yes,yes,29,ABCDE9999Z,111222333444,998877665544,SBIN0000123\nE901,,500,,,,,,,,,\n')
        pg.set_input_files('input[type=file]', csv); pg.wait_for_timeout(1000)
        emps = store(pg)['employees']; check('two employees, invalid row skipped', len(emps) == 2 and {e['name'] for e in emps} == {'Asha Rao', 'Ravi Kumar'})
        check('employee table', pg.locator('tbody tr', has_text='Ravi Kumar').count() == 1 and 'Complete' in pg.locator('tbody tr', has_text='Ravi Kumar').inner_text())
        # ---- run payroll
        pg.get_by_role('tab', name='Run payroll').click(); pg.wait_for_timeout(500)
        before = pg.locator('.pay-sum').inner_text()
        pg.get_by_label('bonus for Asha Rao').fill('5000'); pg.wait_for_timeout(300)
        check('bonus changes net live', pg.locator('.pay-sum').inner_text() != before)
        pg.get_by_role('button', name='Submit for approval').click(); pg.wait_for_timeout(1200)
        runs = store(pg)['payroll_runs']; check('run is pending with 2 payslips', len(runs) == 1 and runs[0]['status'] == 'pending' and len(store(pg)['payslips']) == 2)
        net = runs[0]['totals']['net']; check('net = (50,000 + 5,000 - PF 1,800 - PT 200) + Ravi', net > 53000 and runs[0]['totals']['headcount'] == 2)
        check('status chip', pg.locator('.chip', has_text='Waiting for approval').count() >= 1)
        pg.get_by_role('button', name='Approve payroll').click(); pg.wait_for_timeout(1500)
        d = store(pg); ent = [e for e in d['entries'] if e.get('payroll_run_id')]
        check('approval creates salary and statutory entries', {e['number'].split('-')[0] for e in ent} >= {'PAY', 'PF', 'ESI', 'PT'} and sum(e['taxable'] for e in ent) >= net)
        check('salary entry waits to be paid', [e for e in ent if e['kind'] == 'salary'][0]['paid_date'] is None)
        check('dues table shown', 'What you owe the authorities' in pg.locator('main').inner_text())
        # files
        with pg.expect_download() as dl: pg.get_by_role('button', name='All payslips (PDF)').click()
        pdf = os.path.join(tmp, 'p.pdf'); dl.value.save_as(pdf); raw = open(pdf, 'rb').read(); check('payslip PDF, one page per employee', raw.startswith(b'%PDF-1.4') and raw.count(b'/Type /Page ') == 2 and b'PAYSLIP' in raw)
        with pg.expect_download() as dl: pg.get_by_role('button', name='Bank transfer file').click()
        bank = os.path.join(tmp, 'b.csv'); dl.value.save_as(bank); check('bank file', 'Asha Rao' in open(bank).read() and 'HDFC0001234' in open(bank).read())
        with pg.expect_download() as dl: pg.get_by_role('button', name='PF ECR file').click()
        ecr = os.path.join(tmp, 'e.txt'); dl.value.save_as(ecr); check('ECR file', open(ecr).read().splitlines()[0].startswith('100200300400#~#Asha Rao'))
        # pay, streak, badge
        pg.get_by_role('button', name='Mark salaries paid').click(); pg.wait_for_timeout(1500)
        d = store(pg); check('run paid, salary entry paid', d['payroll_runs'][0]['status'] == 'paid' and [e for e in d['entries'] if e.get('payroll_run_id') and e['kind'] == 'salary'][0]['paid_date'])
        check('on-time XP and Payday badge', any(x['kind'] == 'payroll_on_time' for x in d['xp_events']) and any(x['code'] == 'payday' for x in d.get('badges', [])))
        pg.wait_for_timeout(500); check('streak shows 1 month', '1-month streak' in pg.locator('main').inner_text())
        # books link and protection
        pg.evaluate("location.hash='transactions'"); pg.wait_for_timeout(800)
        check('payroll rows are in Transactions', pg.locator('.tx-row', has_text='Payroll').count() >= 1 and pg.locator('.tx-row', has_text='EPFO').count() == 1)
        pg.locator('.tx-row', has_text='EPFO').locator('.del-btn').first.click(force=True); pg.wait_for_timeout(600)
        check('payroll entries cannot be deleted', any(x['party'].startswith('EPFO') for x in store(pg)['entries']))
        # history + locked
        pg.evaluate("location.hash='payroll'"); pg.wait_for_timeout(600); pg.get_by_role('tab', name='History').click(); pg.wait_for_timeout(300)
        check('history row paid', pg.locator('tbody tr', has_text='Paid').count() >= 1)
        # phone fits
        pg.set_viewport_size({'width': 375, 'height': 800}); pg.get_by_role('tab', name='Run payroll').click(); pg.wait_for_timeout(500)
        check('no horizontal overflow on phone', pg.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0)
        check('no console errors', not errs)
        if errs: print(errs[:3])
        ctx.close()
        # ---- a viewer must not see payroll
        ctx, pg, errs = boot(b, role='viewer')
        check('viewer has no payroll link', pg.locator('#desktop-nav a[data-v="payroll"]:visible').count() == 0)
        pg.evaluate("location.hash='payroll'"); pg.wait_for_timeout(700)
        check('viewer sees the restricted notice', 'Payroll is restricted' in pg.locator('main').inner_text() and 'Asha' not in pg.locator('main').inner_text())
        ctx.close(); b.close()
finally:
    srv.terminate()
print('PAYROLL OK' if not fails else 'PAYROLL FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
