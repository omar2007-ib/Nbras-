#!/usr/bin/env python3
"""iPad-sized Safari-engine smoke checks for Athar.

This uses Playwright WebKit with iPad-like portrait/landscape viewports and touch
input enabled. It is a CI simulation of Safari/WebKit, not a physical iPad test.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PROFILES = (
    ("iPad portrait", 810, 1080),
    ("iPad landscape", 1080, 810),
)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    pages = sorted(DIST.glob("*.html"))
    if not pages:
        print("FAIL: dist/ has no generated HTML pages; run scripts/build_static.py first.")
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
            browser = playwright.webkit.launch()
            try:
                for html in pages:
                    route = "/" + html.name
                    for profile, width, height in PROFILES:
                        context = browser.new_context(
                            viewport={"width": width, "height": height},
                            device_scale_factor=2,
                            has_touch=True,
                            accept_downloads=True,
                        )
                        page = context.new_page()
                        page.on(
                            "pageerror",
                            lambda error, path=route, label=profile:
                                page_errors.append(f"{path} ({label}): {error}"),
                        )
                        try:
                            response = page.goto(
                                base_url + route, wait_until="load", timeout=25000
                            )
                            checks += 1
                            if response is None or not response.ok:
                                failures.append(
                                    f"{route} ({profile}): page did not return a successful response."
                                )
                                continue

                            metrics = page.evaluate("""() => ({
                              viewport: document.documentElement.clientWidth,
                              content: document.documentElement.scrollWidth,
                              bodyWidth: document.body ? document.body.scrollWidth : 0,
                              title: document.title,
                              interactiveCount: document.querySelectorAll(
                                'a[href],button,input,select,textarea,summary,[role="button"]'
                              ).length
                            })""")
                            if metrics["content"] > metrics["viewport"] + 1:
                                failures.append(
                                    f"{route} ({profile}): horizontal overflow "
                                    f"({metrics['content']}px content vs {metrics['viewport']}px viewport)."
                                )
                            if not metrics["title"].strip():
                                failures.append(f"{route} ({profile}): document title is empty.")
                            if metrics["interactiveCount"] == 0:
                                failures.append(
                                    f"{route} ({profile}): no interactive controls were found."
                                )

                            # Confirm that touch capability is available in the emulated context.
                            touch = page.evaluate(
                                "() => ({maxTouchPoints: navigator.maxTouchPoints, "
                                "hasTouchEvent: 'ontouchstart' in window})"
                            )
                            if touch["maxTouchPoints"] < 1 and not touch["hasTouchEvent"]:
                                failures.append(
                                    f"{route} ({profile}): touch capability was not exposed by WebKit."
                                )

                            # Test that the first visible interactive element can receive focus.
                            page.keyboard.press("Tab")
                            focus = page.evaluate("""() => {
                              const el = document.activeElement;
                              if (!el || el === document.body || el === document.documentElement) {
                                return {interactive: false, visible: false};
                              }
                              const style = getComputedStyle(el);
                              const rect = el.getBoundingClientRect();
                              const interactive = el.matches(
                                'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'
                              );
                              const visible = rect.width > 0 && rect.height > 0 &&
                                style.visibility !== 'hidden' && style.display !== 'none';
                              return {interactive, visible, left: rect.left, right: rect.right};
                            }""")
                            if not focus["interactive"] or not focus["visible"]:
                                failures.append(
                                    f"{route} ({profile}): keyboard focus did not reach a visible interactive element."
                                )
                            elif focus["left"] < -1 or focus["right"] > width + 1:
                                failures.append(
                                    f"{route} ({profile}): focused element is horizontally obscured."
                                )
                        except Exception as exc:
                            failures.append(f"{route} ({profile}): {exc}")
                        finally:
                            context.close()
                failures.extend("JavaScript page error: " + error for error in page_errors)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print(f"iPad WebKit checks: {checks} page/viewport combinations across {len(pages)} HTML pages.")
    print("Profiles: iPad portrait 810x1080, iPad landscape 1080x810; touch enabled; device scale factor 2.")
    if failures:
        for failure in failures:
            print("FAIL: " + failure)
        print(f"Result: FAILED ({len(failures)} issue(s)).")
        return 1
    print("Result: PASSED (no horizontal overflow, missing titles/controls, focus visibility, or page errors detected).")
    print("Limit: this is WebKit CI emulation, not a test on a physical iPad or installed Safari.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
