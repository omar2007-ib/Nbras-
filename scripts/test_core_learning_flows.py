#!/usr/bin/env python3
"""End-to-end browser checks for Athar's core learning interactions.

Runs against the generated static site. Cloud authentication, Supabase permissions,
and live provider responses are intentionally outside this local-only test.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    if not (DIST / "practice.html").is_file() or not (DIST / "study-plan.html").is_file():
        print("FAIL: required pages missing from dist/; build the site first.")
        return 1

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(DIST), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    failures = []
    passed = 0

    def check(condition, message):
        nonlocal passed
        if condition:
            passed += 1
            print("PASS: " + message)
        else:
            failures.append(message)
            print("FAIL: " + message)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": 1024, "height": 900})
                page_errors = []
                page.on("pageerror", lambda error: page_errors.append(str(error)))

                response = page.goto(base_url + "/practice.html", wait_until="load")
                check(bool(response and response.ok), "practice page loads")
                check(page.locator("fieldset.question").count() == 5, "practice quiz contains exactly five questions")
                for name, answer in [("q0", "2"), ("q1", "1"), ("q2", "0"), ("q3", "3"), ("q4", "2")]:
                    page.locator(f'input[name="{name}"][value="{answer}"]').check()
                page.locator("#quiz button[type=submit]").click()
                result = page.locator("#result").inner_text()
                check("5 من 5" in result and "100٪" in result, "all correct answers produce a 100% score")
                check(page.locator(".question .feedback").count() == 5, "each practice question displays feedback and an explanation")

                response = page.goto(base_url + "/study-plan.html", wait_until="load")
                check(bool(response and response.ok), "study-plan page loads")
                page.evaluate("localStorage.removeItem('athar-study-tasks')")
                page.reload(wait_until="load")
                task_input = page.locator("[data-task-form] input")
                task_input.fill("اختبار حفظ المهمة")
                page.locator("[data-task-form] button[type=submit]").click()
                check(page.locator("[data-task-list] .task").count() == 1, "study task can be added")
                check("0 من 1" in page.locator("[data-task-count]").inner_text(), "task count starts incomplete")
                page.locator('[data-task-list] input[type=checkbox]').check()
                check("1 من 1" in page.locator("[data-task-count]").inner_text(), "completing a task updates progress")
                page.reload(wait_until="load")
                check(page.locator("[data-task-list] .task").count() == 1 and page.locator('[data-task-list] input[type=checkbox]').is_checked(), "task and completion state persist after reload")
                page.locator("[data-task-list] button").click()
                check(page.locator("[data-task-list] .task").count() == 0, "individual task can be deleted")
                task_input = page.locator("[data-task-form] input")
                task_input.fill("مهمة لمسح الكل")
                page.locator("[data-task-form] button[type=submit]").click()
                page.once("dialog", lambda dialog: dialog.accept())
                page.locator("[data-clear-tasks]").click()
                check(page.locator("[data-task-list] .task").count() == 0, "clear-all removes tasks after confirmation")
                check(not page_errors, "core learning interactions produce no uncaught JavaScript errors")
                for error in page_errors:
                    print("BROWSER ERROR: " + error)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print(f"Core browser interaction checks: {passed} passed, {len(failures)} failed.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
