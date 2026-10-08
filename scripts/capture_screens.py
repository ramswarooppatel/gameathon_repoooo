import os
import time
from playwright.sync_api import sync_playwright

def capture_screens():
    os.makedirs('docs/screens', exist_ok=True)
    
    viewports = {
        'desktop': {'width': 1440, 'height': 900},
        'mobile': {'width': 375, 'height': 667}
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for vp_name, vp_dims in viewports.items():
            context = browser.new_context(viewport=vp_dims, device_scale_factor=2)
            page = context.new_page()
            
            # Initial load and enter demo mode
            page.goto('http://localhost:3000/#dashboard', wait_until='networkidle')
            page.wait_for_timeout(400)
            
            # Click "Continue in demo mode" if modal is present
            demo_btn = page.locator('#auth button:has-text("Continue in demo mode"), #auth button:has-text("demo")')
            if demo_btn.count() > 0 and demo_btn.first.is_visible():
                demo_btn.first.click()
                page.wait_for_timeout(600)
            
            # Load sample data if empty
            page.evaluate("""() => {
                if (window.A && window.A.demo && window.S && window.S.entries && window.S.entries.length === 0) {
                    window.A.demo();
                }
            }""")
            page.wait_for_timeout(500)
            
            # 1. Dashboard
            page.goto('http://localhost:3000/#dashboard', wait_until='networkidle')
            page.wait_for_timeout(600)
            page.screenshot(path=f'docs/screens/dashboard-{vp_name}.png')
            print(f'Captured dashboard-{vp_name}.png')
            
            # 2. Transactions
            page.goto('http://localhost:3000/#transactions', wait_until='networkidle')
            page.wait_for_timeout(600)
            page.screenshot(path=f'docs/screens/transactions-{vp_name}.png')
            print(f'Captured transactions-{vp_name}.png')
            
            # 3. Approvals
            page.goto('http://localhost:3000/#approvals', wait_until='networkidle')
            page.wait_for_timeout(600)
            page.screenshot(path=f'docs/screens/approvals-{vp_name}.png')
            print(f'Captured approvals-{vp_name}.png')
            
            # 4. Reports
            page.goto('http://localhost:3000/#reports', wait_until='networkidle')
            page.wait_for_timeout(600)
            page.screenshot(path=f'docs/screens/reports-{vp_name}.png')
            print(f'Captured reports-{vp_name}.png')
            
            # 5. Rewards
            page.goto('http://localhost:3000/#rewards', wait_until='networkidle')
            page.wait_for_timeout(600)
            page.screenshot(path=f'docs/screens/rewards-{vp_name}.png')
            print(f'Captured rewards-{vp_name}.png')
            
            # 6. Levelup Celebration Modal (Clicking button)
            page.goto('http://localhost:3000/#rewards', wait_until='networkidle')
            page.wait_for_timeout(500)
            cert_btn = page.locator('button:has-text("View Certificate / Share Card")')
            if cert_btn.count() > 0:
                cert_btn.first.click()
                page.wait_for_timeout(800)
            page.screenshot(path=f'docs/screens/levelup-{vp_name}.png')
            print(f'Captured levelup-{vp_name}.png')
            
            # 7. Sign-in Modal
            page.goto('http://localhost:3000/#dashboard', wait_until='networkidle')
            page.wait_for_timeout(400)
            page.evaluate("""() => {
                if (window.A && window.A.signOut) {
                    window.A.signOut();
                }
            }""")
            page.wait_for_timeout(600)
            page.screenshot(path=f'docs/screens/signin-{vp_name}.png')
            print(f'Captured signin-{vp_name}.png')
            
            context.close()
            
        browser.close()

if __name__ == '__main__':
    capture_screens()
    print('ALL 14 SCREENS CAPTURED OK')
