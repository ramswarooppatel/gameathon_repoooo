"""Add-transaction dialog, invoice <-> transaction links and PDF download. Run: python scripts/txn_test.py -> TXN OK or the failing steps."""
import subprocess, sys, os, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3134', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond):
    if not cond: fails.append(name)
DATA = json.dumps({'org': {'name': 'Acme Traders', 'gstin': '27AAPFU0939F1ZV', 'opening_balance': 100000, 'monthly_goal': 0, 'approval_limit': 25000, 'invite_code': 'x',
                           'invoice_settings': {'address': '12 MG Road', 'city': 'Mumbai', 'pincode': '400001', 'upi': 'acme@upi', 'prefix': 'ACM'}}, 'role': 'admin'})
def store(pg): return json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')"))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block', accept_downloads=True)
        ctx.add_init_script("localStorage.setItem('myf-notice','1');" + f"if(!localStorage.getItem('myf-demo-data'))localStorage.setItem('myf-demo-data', {json.dumps(DATA)});")
        pg = ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: d.accept()); pg.goto('http://localhost:3134/index.html'); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click()
        pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached'); pg.wait_for_timeout(800)
        dlg = pg.locator('dialog.entry-dialog-modal')
        # open with the n shortcut
        pg.keyboard.press('n'); pg.wait_for_timeout(900)
        check('n opens the dialog', dlg.get_by_role('radio').count() >= 4 and dlg.is_visible())
        check('sale shows the invoice callout', dlg.locator('.callout').is_visible())
        dlg.get_by_role('button', name='Create invoice').click(); pg.wait_for_timeout(800)
        check('create invoice opens the form', pg.locator('.inv-form').count() == 1 and pg.evaluate('location.hash') == '#invoices')
        pg.get_by_role('button', name='Back').click(); pg.wait_for_timeout(300)
        # expense, GST included, already paid
        pg.evaluate("location.hash='transactions'"); pg.wait_for_timeout(600); pg.get_by_role('button', name='+ Add transaction').first.click(); pg.wait_for_timeout(500)
        dlg.get_by_role('radio', name='Expense').click(); pg.wait_for_timeout(200)
        check('expense hides the invoice callout, shows category', not dlg.locator('.callout').is_visible() and dlg.get_by_placeholder('Used for budgets and reports').is_visible())
        dlg.get_by_placeholder('Shop, landlord, service…').fill('Landlord'); dlg.get_by_role('radio', name='GST included').click(); pg.wait_for_timeout(300);dlg.get_by_placeholder('0.00').fill('11800'); dlg.get_by_placeholder('Used for budgets and reports').fill('Rent')
        dlg.locator('.chips-seg').get_by_role('radio', name='18%').click(); dlg.get_by_label('Already paid').check(); pg.wait_for_timeout(300)
        summ = dlg.locator('.tax-preview-card').inner_text()
        check('summary splits inclusive amount', '10,000' in summ and '11,800' in summ and '900' in summ and 'Recorded as paid' in summ)
        dlg.get_by_role('button', name='Save and add another').click(); pg.wait_for_timeout(1200)
        check('add another keeps dialog open and clears', dlg.is_visible() and dlg.get_by_placeholder('0.00').input_value() == '')
        e = [x for x in store(pg)['entries'] if x['party'] == 'Landlord']
        check('expense saved precisely', len(e) == 1 and e[0]['taxable'] == 10000 and e[0]['gst_rate'] == 18 and e[0]['paid_date'] and e[0]['category'] == 'Rent')
        # payroll: no GST controls
        dlg.get_by_role('radio', name='Payroll').click(); pg.wait_for_timeout(200)
        check('payroll hides GST', not dlg.locator('.chips-seg').is_visible())
        dlg.get_by_placeholder('Name of the employee').fill('Asha'); dlg.get_by_placeholder('0.00').fill('30000'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
        s = [x for x in store(pg)['entries'] if x['party'] == 'Asha']
        check('payroll saved with 0 GST', len(s) == 1 and s[0]['gst_rate'] == 0 and s[0]['taxable'] == 30000 and not dlg.is_visible())
        # invoice -> transactions link
        pg.keyboard.press('i'); pg.wait_for_timeout(900)
        pg.get_by_placeholder('Customer name').fill('Bharat Buyers'); r = pg.locator('.inv-row:not(.inv-head)').first
        r.locator('input').nth(0).fill('Laptop'); r.locator('input').nth(1).fill('8471'); r.locator('input').nth(3).fill('55000'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(1500)
        with pg.expect_download() as d: pg.get_by_role('button', name='PDF').first.click()
        path = os.path.join(ROOT, 'deck', '_i.pdf'); d.value.save_as(path); raw = open(path, 'rb').read(); os.remove(path)
        check('invoice PDF downloads', raw.startswith(b'%PDF-1.4') and b'ACM/26-27/0001' in raw and d.value.suggested_filename == 'Invoice-ACM-26-27-0001.pdf')
        pg.get_by_role('button', name='Entries').first.click(); pg.wait_for_timeout(800)
        check('Entries shows the invoice rows', pg.evaluate('location.hash') == '#transactions' and pg.locator('.tx-row', has_text='Bharat Buyers').count() == 1 and pg.locator('.tx-row', has_text='Landlord').count() == 0)
        row = pg.locator('.tx-row', has_text='Bharat Buyers')
        check('row links to invoice, no delete', row.locator('button.linklike').count() == 1 and row.locator('.del-btn').count() == 0)
        with pg.expect_download() as d2: row.locator('button', has_text='PDF').click(force=True)
        check('PDF from transactions', d2.value.suggested_filename.endswith('.pdf'))
        with ctx.expect_page() as np: row.locator('button.linklike').click(force=True)
        np.value.wait_for_load_state(); check('link opens the invoice', 'TAX INVOICE' in np.value.inner_text('body')); np.value.close()
        # phone: dialog fits
        pg.set_viewport_size({'width': 375, 'height': 800}); pg.get_by_role('button', name='+ Add transaction').first.click(); pg.wait_for_timeout(500)
        check('dialog fits a phone', pg.evaluate("(()=>{const d=document.querySelector('dialog.entry-dialog-modal');return d.scrollWidth<=d.clientWidth+1})()"))
        check('no console errors', not errs)
        if errs: print(errs[:3])
        b.close()
finally:
    srv.terminate()
print('TXN OK' if not fails else 'TXN FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
