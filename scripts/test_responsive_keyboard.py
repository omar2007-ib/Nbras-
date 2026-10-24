#!/usr/bin/env python3
"""Browser-level responsive and keyboard smoke checks for Athar's static site.

Requires Playwright (installed by the GitHub Actions workflow). It tests generated
public HTML only; it does not authenticate or exercise protected backend flows.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import os
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
VIEWPORTS = (375, 768, 1024, 1440)
MAX_TAB_STEPS = 24


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    pages = sorted(DIST.glob("*.html"))
    if not pages:
        print("FAIL: dist/ has no generated HTML pages; run build_static.py first.")
        return 1

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(DIST), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    failures = []
    page_errors = []
    checks = 0

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                for html in pages:
                    route = "/" + html.name
                    for width in VIEWPORTS:
                        page = browser.new_page(
                            viewport={"width": width, "height": 900},
                            device_scale_factor=1,
                        )
                        page.on("pageerror", lambda error, path=route, w=width:
                                page_errors.append(f"{path} @ {w}px: {error}"))
                        response = page.goto(base_url + route, wait_until="networkidle", timeout=20000)
                        checks += 1
                        if response is None or not response.ok:
                            failures.append(f"{route} @ {width}px: page did not return a successful response.")
                            page.close()
                            continue

                        overflow = page.evaluate(
                            "() => ({viewport: document.documentElement.clientWidth, "
                            "content: document.documentElement.scrollWidth, "
                            "body: document.body.scrollWidth})"
                        )
                        if overflow["content"] > overflow["viewport"] + 1:
                            failures.append(
                                f"{route} @ {width}px: horizontal page overflow "
                                f"({overflow['content']}px content vs {overflow['viewport']}px viewport)."
                            )

                        # Verify sequential keyboard navigation can focus an interactive control
                        # and that the focused control has a visible focus indicator.
                        page.keyboard.press("Tab")
                        focus = page.evaluate("""() => {
                          const el = document.activeElement;
                          if (!el || el === document.body || el === document.documentElement) {
                            return {tag: el ? el.tagName : null, visible: false, interactive: false};
                          }
                          const style = getComputedStyle(el);
                          const rect = el.getBoundingClientRect();
                          const interactive = el.matches('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])');
                          const visible = style.outlineStyle !== 'none' &&
                            parseFloat(style.outlineWidth || '0') > 0 ||
                            style.boxShadow !== 'none';
                          return {tag: el.tagName, visible, interactive,
                            rect: {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom}};
                        }""")
                        if not focus["interactive"]:
                            failures.append(f"{route} @ {width}px: Tab did not focus an interactive element.")
                        elif not focus["visible"]:
                            failures.append(f"{route} @ {width}px: first keyboard focus has no visible indicator.")
                        elif focus.get("rect") and (
                            focus["rect"]["left"] < -1 or focus["rect"]["right"] > width + 1
                        ):
                            failures.append(f"{route} @ {width}px: first keyboard focus is horizontally obscured.")
                        page.close()
                browser.close()
            finally:
                pass
    finally:
        server.shutdown()
        server.server_close()

    failures.extend("JavaScript page error: " + error for error in page_errors)
    print(f"Responsive browser checks: {checks} page/viewport combinations across {len(pages)} pages.")
    print("Viewport widths (CSS px): " + ", ".join(map(str, VIEWPORTS)))
    if failures:
        for failure in failures:
            print("FAIL: " + failure)
        print(f"Result: FAILED ({len(failures)} issue(s)).")
        return 1
    print("Result: PASSED (no horizontal page overflow, first-tab focus, or page errors detected).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
