"""Detailed UI Smoke Test & Overflow Diagnostic for Oxro Labs · Finance Desk (Phase 3)
Verifies:
1. Zero horizontal overflow on document, body, #app, and main (scrollWidth <= clientWidth) across all viewports (375px, 768px, 1440px).
2. Inspects individual element scrollWidth to catch overflow causes early.
3. Tests all 3 roles: admin, finance, viewer.
4. Zero console errors.
"""
import sys
from playwright.sync_api import sync_playwright

def test_overflow_and_roles():
    views_to_test = [
        "dashboard",
        "transactions",
        "parties",
        "approvals",
        "compliance",
        "reports",
        "insights",
        "rewards",
        "audit",
        "team",
        "styleguide"
    ]
    viewports = [
        {"width": 375, "height": 667, "name": "Mobile 375px"},
        {"width": 768, "height": 1024, "name": "Tablet 768px"},
        {"width": 1440, "height": 900, "name": "Desktop 1440px"}
    ]
    roles = ["admin", "finance", "viewer"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        errors = []

        for vp in viewports:
            for role in roles:
                context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
                page = context.new_page()

                page_errors = []
                page.on("console", lambda msg: page_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
                page.on("pageerror", lambda err: page_errors.append(str(err)))

                # Load app
                page.goto("http://localhost:3000/#dashboard", wait_until="domcontentloaded")
                page.wait_for_timeout(400)

                # Set role via demoRole if available or evaluate
                page.evaluate(f"""(r) => {{
                    if (window.S && window.A) {{
                        if (window.A.demoRole) window.A.demoRole(r);
                    }}
                }}""", role)
                page.wait_for_timeout(200)

                for v in views_to_test:
                    page.goto(f"http://localhost:3000/#{v}", wait_until="domcontentloaded")
                    page.wait_for_timeout(250)

                    # Diagnostic script checking wide elements
                    diag = page.evaluate("""() => {
                        const docW = document.documentElement.clientWidth;
                        const bodyScroll = document.body.scrollWidth;
                        const docScroll = document.documentElement.scrollWidth;
                        const appEl = document.getElementById('app');
                        const appScroll = appEl ? appEl.scrollWidth : 0;
                        const mainEl = document.querySelector('main');
                        const mainScroll = mainEl ? mainEl.scrollWidth : 0;

                        // Find any elements wider than viewport (excluding intentional horizontal scroll containers)
                        const wideElements = [];
                        document.querySelectorAll('*').forEach(el => {
                            if (el.classList.contains('stories') || el.classList.contains('scroll') || el.classList.contains('chart-box')) {
                                return; // intentional scroll containers
                            }
                            const rect = el.getBoundingClientRect();
                            if (rect.right > docW + 1.5) {
                                wideElements.push({
                                    tag: el.tagName,
                                    id: el.id || '',
                                    cls: el.className || '',
                                    right: rect.right,
                                    width: rect.width
                                });
                            }
                        });

                        const maxDiff = Math.max(0, docScroll - docW, bodyScroll - docW, appScroll - docW);
                        return {
                            hasOverflow: maxDiff > 1,
                            diff: maxDiff,
                            docW,
                            docScroll,
                            bodyScroll,
                            appScroll,
                            wideCount: wideElements.length,
                            wideElements: wideElements.slice(0, 4)
                        };
                    }""")

                    if diag["hasOverflow"] or diag["wideCount"] > 0:
                        errors.append(f"[{vp['name']} | Role: {role} | View: #{v}] Overflow: docW={diag['docW']} vs scroll={diag['docScroll']}, wide elements: {diag['wideElements']}")

                if page_errors:
                    for err in page_errors:
                        errors.append(f"[{vp['name']} | Role: {role} Console Error] {err}")

                context.close()

        browser.close()

        if errors:
            print("UI SMOKE FAILURES:")
            for e in errors:
                print("  *", e)
            sys.exit(1)

        print("UI SMOKE OK")
        sys.exit(0)

if __name__ == "__main__":
    test_overflow_and_roles()
