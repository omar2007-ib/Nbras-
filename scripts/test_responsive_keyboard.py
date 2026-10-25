#!/usr/bin/env python3
"""Browser-level responsive and keyboard smoke checks for Athar's static site.

Requires Playwright (installed by the GitHub Actions workflow). It tests generated
public HTML only; it does not authenticate or exercise protected backend flows.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
VIEWPORTS = (375, 768, 1024, 1440)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass



def test_design_studio(browser, base_url, failures, page_errors):
    context = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    page = context.new_page()
    page.on("pageerror", lambda error: page_errors.append(f"design-studio.html interaction: {error}"))
    try:
        response = page.goto(base_url + "/design-studio.html", wait_until="load", timeout=20000)
        if response is None or not response.ok:
            failures.append("design-studio.html: failed to open for interaction testing.")
            return
        page.locator("#design-title").fill("اختبار تصميم أثَر")
        page.locator("#design-body").fill("نص تجريبي للتحقق من تصدير التصميم.")
        page.locator("#design-form button[type=submit]").click()
        page.wait_for_function("""() => {
          const image = document.querySelector('#design-preview img');
          return !!image && image.complete && image.naturalWidth > 0;
        }""", timeout=10000)
        if page.locator("#download-svg").is_disabled():
            failures.append("design studio: SVG export remained disabled after rendering.")
        with page.expect_download(timeout=10000) as download_info:
            page.locator("#download-svg").click()
        svg_download = download_info.value
        svg_path = Path(svg_download.path())
        svg_text = svg_path.read_text(encoding="utf-8")
        if not svg_text.startswith("<svg") or "#5B21B6" not in svg_text:
            failures.append("design studio: SVG export is missing its root or approved brand color.")
        with page.expect_download(timeout=10000) as download_info:
            page.locator("#download-png").click()
        png_download = download_info.value
        if Path(png_download.path()).stat().st_size < 1000:
            failures.append("design studio: PNG export was unexpectedly small or empty.")
        with page.expect_download(timeout=10000) as download_info:
            page.locator("#download-tokens").click()
        token_download = download_info.value
        import json
        tokens = json.loads(Path(token_download.path()).read_text(encoding="utf-8"))
        if tokens.get("palette", {}).get("primary") != "#5B21B6":
            failures.append("design studio: exported identity tokens do not contain the approved primary color.")
    except Exception as exc:
        failures.append(f"design studio browser flow: {exc}")
    finally:
        context.close()


def create_test_video(folder):
    import shutil
    import subprocess

    candidates = sorted(Path.home().glob(".cache/ms-playwright/ffmpeg-*/ffmpeg-linux"))
    ffmpeg = str(candidates[-1]) if candidates else shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("No FFmpeg binary was found for creating the local test fixture.")

    mp4_path = Path(folder) / "athar-smoke-test.mp4"
    webm_path = Path(folder) / "athar-smoke-test.webm"
    commands = [
        [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "color=c=purple:s=320x180:r=15:d=2",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=2",
            "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(mp4_path),
        ],
        [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "color=c=purple:s=320x180:r=15:d=2",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=2",
            "-shortest", "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "200k",
            "-c:a", "libopus", "-b:a", "64k", "-f", "webm", str(webm_path),
        ],
    ]
    errors = []
    for command in commands:
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        output = Path(command[-1])
        if result.returncode == 0 and output.exists() and output.stat().st_size > 1000:
            return output
        errors.append(result.stderr.strip()[-1000:])
    raise RuntimeError("Could not generate a valid synthetic browser-test video: " + " | ".join(errors))


def test_video_studio(browser, base_url, failures, page_errors):
    import tempfile

    context = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    page = context.new_page()
    page.on("pageerror", lambda error: page_errors.append(f"video-studio.html interaction: {error}"))
    try:
        response = page.goto(base_url + "/video-studio.html", wait_until="load", timeout=20000)
        if response is None or not response.ok:
            failures.append("video-studio.html: failed to open for interaction testing.")
            return
        with tempfile.TemporaryDirectory(prefix="athar-video-test-") as folder:
            video_path = create_test_video(folder)
            if video_path.stat().st_size < 1000:
                failures.append("video studio test fixture was empty.")
                return
            page.locator("#video-file").set_input_files(str(video_path))
            try:
                page.wait_for_function("() => !document.querySelector('#export-short').disabled", timeout=15000)
            except Exception as exc:
                failures.append(
                    "video studio: local video did not become ready: " + str(exc)
                    + "; status=" + page.locator("#studio-status").inner_text()
                    + "; metadata=" + page.locator("#video-meta").inner_text()
                )
                return
            page.locator("#clip-duration").fill("1")
            page.locator("#clip-duration").press("Tab")
            page.locator("#caption-start").fill("0")
            page.locator("#caption-end").fill("0.8")
            page.locator("#caption-text").fill("اختبار الترجمة")
            page.locator("#add-caption").click()
            if page.locator("#caption-list li").count() != 1:
                failures.append("video studio: caption was not added to the list.")
            with page.expect_download(timeout=10000) as download_info:
                page.locator("#download-srt").click()
            srt_download = download_info.value
            srt_text = Path(srt_download.path()).read_text(encoding="utf-8-sig")
            if "00:00:00,000 --> 00:00:00,800" not in srt_text or "اختبار الترجمة" not in srt_text:
                failures.append("video studio: SRT export did not preserve caption timing/text.")
            page.locator("#export-short").click()
            page.wait_for_function("() => !document.querySelector('#download-video').hidden", timeout=20000)
            if page.locator("#output-preview").is_hidden():
                failures.append("video studio: output preview did not become visible after export.")
            with page.expect_download(timeout=10000) as download_info:
                page.locator("#download-video").click()
            video_download = download_info.value
            if Path(video_download.path()).stat().st_size < 1000:
                failures.append("video studio: exported video was unexpectedly small or empty.")
    except Exception as exc:
        failures.append(f"video studio browser flow: {exc}")
    finally:
        context.close()

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
                        page.on(
                            "pageerror",
                            lambda error, path=route, w=width:
                                page_errors.append(f"{path} @ {w}px: {error}"),
                        )
                        response = page.goto(
                            base_url + route, wait_until="load", timeout=20000
                        )
                        checks += 1
                        if response is None or not response.ok:
                            failures.append(
                                f"{route} @ {width}px: page did not return a successful response."
                            )
                            page.close()
                            continue

                        overflow = page.evaluate(
                            "() => ({viewport: document.documentElement.clientWidth, "
                            "content: document.documentElement.scrollWidth})"
                        )
                        if overflow["content"] > overflow["viewport"] + 1:
                            failures.append(
                                f"{route} @ {width}px: horizontal page overflow "
                                f"({overflow['content']}px content vs {overflow['viewport']}px viewport)."
                            )

                        # Smoke-test the first keyboard focus stop and its visible indicator.
                        page.keyboard.press("Tab")
                        focus = page.evaluate("""() => {
                          const el = document.activeElement;
                          if (!el || el === document.body || el === document.documentElement) {
                            return {tag: el ? el.tagName : null, visible: false, interactive: false};
                          }
                          const style = getComputedStyle(el);
                          const rect = el.getBoundingClientRect();
                          const interactive = el.matches('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])');
                          const visible = (style.outlineStyle !== 'none' &&
                            parseFloat(style.outlineWidth || '0') > 0) ||
                            style.boxShadow !== 'none';
                          return {tag: el.tagName, visible, interactive,
                            rect: {left: rect.left, right: rect.right}};
                        }""")
                        if not focus["interactive"]:
                            failures.append(
                                f"{route} @ {width}px: Tab did not focus an interactive element."
                            )
                        elif not focus["visible"]:
                            failures.append(
                                f"{route} @ {width}px: first keyboard focus has no visible indicator."
                            )
                        elif focus.get("rect") and (
                            focus["rect"]["left"] < -1 or focus["rect"]["right"] > width + 1
                        ):
                            failures.append(
                                f"{route} @ {width}px: first keyboard focus is horizontally obscured."
                            )
                        page.close()
                test_design_studio(browser, base_url, failures, page_errors)
                test_video_studio(browser, base_url, failures, page_errors)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()

    failures.extend("JavaScript page error: " + error for error in page_errors)
    print(
        f"Responsive browser checks: {checks} page/viewport combinations "
        f"across {len(pages)} pages."
    )
    print("Viewport widths (CSS px): " + ", ".join(map(str, VIEWPORTS)))
    if failures:
        for failure in failures:
            print("FAIL: " + failure)
        print(f"Result: FAILED ({len(failures)} issue(s)).")
        return 1
    print(
        "Result: PASSED (no horizontal page overflow, first-tab focus, "
        "or page errors detected)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
