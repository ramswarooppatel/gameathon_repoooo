"""End-to-end check of invoicing in demo mode: issue an inter-state invoice, e-way JSON, share file, accept it as another org, shortcuts.
Run: python scripts/invoice_test.py  -> prints INVOICE OK or the failing steps."""
import subprocess, sys, os, time, json, tempfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '3129', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
fails = []
def check(name, cond):
    if not cond: fails.append(name)
def org(name, gstin, extra=None):
    return json.dumps({'org': {'name': name, 'gstin': gstin, 'opening_balance': 100000, 'monthly_goal': 0, 'approval_limit': 25000, 'invite_code': 'demo0000',
        'invoice_settings': {'address': '12 MG Road', 'city': 'Mumbai', 'pincode': '400001', 'bank_name': 'HDFC', 'bank_acc': '1234567890', 'bank_ifsc': 'HDFC0000001', 'upi': 'acme@upi', 'prefix': 'ACM'}}, 'role': 'admin'})
def boot(b, data, tmp):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block', accept_downloads=True)
    ctx.add_init_script("localStorage.setItem('myf-notice','1');" + f"if(!localStorage.getItem('myf-demo-data'))localStorage.setItem('myf-demo-data', {json.dumps(data)});")
    pg = ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:3129/index.html'); pg.wait_for_selector('#auth:not([hidden]) button'); pg.get_by_role('button', name='Continue in demo mode').click()
    pg.wait_for_selector('#app:not([hidden]) #view > *', state='attached'); pg.wait_for_timeout(700)
    return ctx, pg, errs
try:
    tmp = tempfile.mkdtemp()
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        # ---------------- seller (Maharashtra) issues to a Karnataka buyer
        ctx, pg, errs = boot(b, org('Acme Traders', '27AAPFU0939F1ZV'), tmp)
        pg.keyboard.press('i'); pg.wait_for_timeout(900)
        check('i opens the form', pg.locator('.inv-form').count() == 1)
        check('auto number', pg.locator('.inv-form input').nth(0).input_value() != '' )
        pg.get_by_placeholder('Customer name').fill('Bharat Buyers'); pg.get_by_placeholder('15-character GSTIN, blank if unregistered').fill('29AABCB1234C1ZA')
        pg.locator('input[placeholder="Pincode"]').fill('560001'); pg.get_by_placeholder('Address').fill('5 Brigade Road, Bengaluru')
        rows = pg.locator('.inv-row:not(.inv-head)')
        rows.nth(0).locator('input').nth(0).fill('Laptop'); rows.nth(0).locator('input').nth(1).fill('8471'); rows.nth(0).locator('input').nth(3).fill('55000')
        rows.nth(0).locator('input').nth(0).press('Enter'); pg.wait_for_timeout(300)
        check('Enter adds a line', pg.locator('.inv-row:not(.inv-head)').count() == 2)
        rows = pg.locator('.inv-row:not(.inv-head)')
        rows.nth(1).locator('input').nth(0).fill('Support plan'); rows.nth(1).locator('input').nth(1).fill('998313'); rows.nth(1).locator('input').nth(3).fill('1000'); rows.nth(1).locator('select').nth(1).select_option('5')
        pg.wait_for_timeout(300)
        tot = pg.locator('.inv-totals').inner_text()
        check('IGST for inter-state', 'IGST' in tot and 'CGST' not in tot)
        check('total 55000*1.18+1000*1.05 = 65,950', '65,950.00' in tot)
        pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(1500)
        check('back on list after issue', pg.locator('.inv-form').count() == 0 and 'Bharat Buyers' in pg.locator('main').inner_text())
        ents = json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')"))
        sales = [e for e in ents['entries'] if e.get('invoice_id')]
        check('one sale entry per GST rate', sorted(e['gst_rate'] for e in sales) == [5, 18] and all(e['supply'] == 'inter' for e in sales))
        check('customer saved with address', any(x['name'] == 'Bharat Buyers' and x.get('address') for x in ents.get('parties', [])))
        # e-way
        pg.get_by_role('button', name='E-way').first.click(); pg.wait_for_timeout(400)
        check('e-way required banner', 'need an e-way bill' in pg.locator('.wide-modal').inner_text())
        pg.get_by_role('button', name='Download NIC JSON').click(); pg.wait_for_timeout(300)
        check('incomplete e-way is rejected', pg.locator('.toast').count() >= 1)
        m = pg.locator('.wide-modal'); m.locator('input').nth(2).fill('980'); m.locator('input').nth(3).fill('mh12ab1234')
        with pg.expect_download() as d: pg.get_by_role('button', name='Download NIC JSON').click()
        path = os.path.join(tmp, 'ew.json'); d.value.save_as(path); ew = json.load(open(path))['billLists'][0]
        check('NIC json', ew['toStateCode'] == 29 and ew['vehicleNo'] == 'MH12AB1234' and ew['totInvValue'] == 65950 and len(ew['itemList']) == 2)
        pg.get_by_role('button', name='Save').click(); pg.wait_for_timeout(600)
        # share file
        pg.get_by_role('button', name='Share').first.click(); pg.wait_for_timeout(300)
        with pg.expect_download() as d: pg.get_by_role('button', name='Download invoice file').click()
        inv_file = os.path.join(tmp, 'inv.json'); d.value.save_as(inv_file); pg.keyboard.press('Escape')
        # print view
        with ctx.expect_page() as np: pg.get_by_role('button', name='View').first.click()
        doc = np.value; doc.wait_for_load_state(); txt = doc.inner_text('body')
        check('print has tax invoice details', 'TAX INVOICE' in txt and 'IGST' in txt and 'Sixty Five Thousand Nine Hundred Fifty' in txt and '27AAPFU0939F1ZV' in txt and 'acme@upi' in txt)
        doc.close()
        # mark paid, then dashboard shows nothing broken
        pg.get_by_role('button', name='Paid').first.click(); pg.wait_for_timeout(900)
        check('paid chip', pg.locator('.chip.good', has_text='Paid').count() == 1)
        # shortcuts
        pg.mouse.click(5, 5); pg.keyboard.press('?'); pg.wait_for_timeout(300)
        check('? opens help', pg.locator('text=Keyboard shortcuts').count() >= 1); pg.keyboard.press('Escape')
        pg.keyboard.press('g'); pg.keyboard.press('d'); pg.wait_for_timeout(600)
        check('g d goes to dashboard', pg.evaluate("location.hash") == '#dashboard')
        # reports/compliance still render with invoice rows
        pg.evaluate("location.hash='compliance'"); pg.wait_for_timeout(700); check('compliance renders', 'GSTR' in pg.locator('main').inner_text())
        check('no console errors (seller)', not errs);
        if errs: print(errs[:3])
        ctx.close()
        # ---------------- buyer (Karnataka) imports and accepts
        ctx, pg, errs = boot(b, org('Bharat Buyers', '29AABCB1234C1ZA'), tmp)
        pg.evaluate("location.hash='invoices'"); pg.wait_for_timeout(500); pg.get_by_role('tab', name='Received').click(); pg.wait_for_timeout(300)
        pg.set_input_files('input[type=file]', inv_file); pg.wait_for_timeout(500)
        mod = pg.locator('.wide-modal').inner_text()
        check('review shows seller + valid GSTIN', 'Acme Traders' in mod and 'GSTIN valid' in mod and '65,950' in mod)
        pg.get_by_role('button', name='Accept and record purchase').click(); pg.wait_for_timeout(1500)
        ents = json.loads(pg.evaluate("localStorage.getItem('myf-demo-data')")); pur = [e for e in ents['entries'] if e['kind'] == 'purchase']
        check('purchases recorded per rate', sorted(e['gst_rate'] for e in pur) == [5, 18] and all(e['gstin'] == '27AAPFU0939F1ZV' for e in pur))
        pg.get_by_role('tab', name='Received').click()
        pg.set_input_files('input[type=file]', inv_file); pg.wait_for_timeout(500)
        check('second import shows already recorded', 'Already recorded' in pg.locator('.wide-modal').inner_text())
        pg.keyboard.press('Escape')
        # tampered file is rejected / flagged
        bad = json.load(open(inv_file)); bad['invoice']['items'][0]['gst'] = 7; badp = os.path.join(tmp, 'bad.json'); json.dump(bad, open(badp, 'w'))
        pg.set_input_files('input[type=file]', badp); pg.wait_for_timeout(500)
        check('invalid file rejected', pg.locator('.wide-modal').count() == 0 and pg.locator('.toast', has_text='Cannot read').count() >= 1)
        check('no console errors (buyer)', not errs)
        if errs: print(errs[:3])
        ctx.close(); b.close()
finally:
    srv.terminate()
print('INVOICE OK' if not fails else 'INVOICE FAIL: ' + '; '.join(fails)); sys.exit(1 if fails else 0)
