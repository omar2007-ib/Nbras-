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

        # Long copy must be rejected explicitly rather than silently clipped.
        page.locator("#design-title").fill(("عنوان طويل " * 12).strip())
        page.locator("#design-form button[type=submit]").click()
        overflow_status = page.locator("#design-status").inner_text()
        if "أطول من المساحة المتاحة" not in overflow_status:
            failures.append("design studio: overflowing title was not rejected with a clear message.")
        if not page.locator("#download-svg").is_disabled():
            failures.append("design studio: SVG download remained enabled after an invalid overflowing title.")

    except Exception as exc:
        failures.append(f"design studio browser flow: {exc}")
    finally:
        context.close()


def test_homepage_brand(browser, base_url, failures, page_errors):
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda error: page_errors.append(f"index.html brand check: {error}"))
    try:
        response = page.goto(base_url + "/index.html", wait_until="load", timeout=20000)
        if response is None or not response.ok:
            failures.append("homepage brand check: index.html failed to load.")
            return
        color = page.locator("h1").evaluate("(element) => getComputedStyle(element).color")
        if color != "rgb(91, 33, 182)":
            failures.append("homepage brand check: approved primary purple is not applied to the main heading.")
        wordmark = page.locator("header .logo")
        if wordmark.locator("span").inner_text().strip() != "أثَر":
            failures.append("homepage brand check: the text-only Athar wordmark is missing.")
        icon = wordmark.locator("img")
        if icon.count() and icon.evaluate("(element) => getComputedStyle(element).display") != "none":
            failures.append("homepage brand check: a separate logo symbol is visible beside the wordmark.")
    except Exception as exc:
        failures.append(f"homepage brand browser flow: {exc}")
    finally:
        page.close()


def create_test_video(page, folder):
    import base64
    import shutil
    import subprocess

    fixture = page.evaluate("""async () => {
      if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
        throw new Error('Browser does not support the media APIs required for this smoke test.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(15);
      const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('No WebM MediaRecorder type is supported.');
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('dataavailable', (event) => { if (event.data && event.data.size) chunks.push(event.data); });
        recorder.addEventListener('stop', resolve, { once: true });
        recorder.addEventListener('error', () => reject(new Error('Synthetic video recording failed.')), { once: true });
      });
      recorder.start(100);
      const start = performance.now();
      await new Promise((resolve) => {
        const draw = () => {
          const elapsed = performance.now() - start;
          context.fillStyle = Math.floor(elapsed / 250) % 2 ? '#5B21B6' : '#C4B5FD';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = '#FFFFFF';
          context.fillRect(40, 40, 240, 100);
          if (elapsed < 1800) requestAnimationFrame(draw); else resolve();
        };
        draw();
      });
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: mimeType });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return { mimeType, base64: btoa(binary) };
    }""")
    raw_path = Path(folder) / "athar-smoke-raw.webm"
    raw_path.write_bytes(base64.b64decode(fixture["base64"]))
    if raw_path.stat().st_size < 1000:
        raise RuntimeError("Synthetic browser-test video was empty.")

    candidates = sorted(Path.home().glob(".cache/ms-playwright/ffmpeg-*/ffmpeg-linux"))
    ffmpeg = str(candidates[-1]) if candidates else shutil.which("ffmpeg")
    if ffmpeg:
        remux_path = Path(folder) / "athar-smoke-test.webm"
        commands = [
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-fflags", "+genpts",
             "-i", str(raw_path), "-c", "copy", "-f", "webm", str(remux_path)],
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(raw_path), "-c", "copy", "-f", "webm", str(remux_path)],
        ]
        for command in commands:
            result = subprocess.run(command, capture_output=True, text=True, timeout=30)
            if result.returncode == 0 and remux_path.exists() and remux_path.stat().st_size > 1000:
                return remux_path
    return raw_path

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
            video_path = create_test_video(page, folder)
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
            # Import a real SRT fixture and verify global timings are shifted to the selected clip.
            subtitle_path = Path(folder) / "imported.srt"
            subtitle_path.write_text(
                "1\n00:00:00,200 --> 00:00:01,200\nترجمة مستوردة\n",
                encoding="utf-8",
            )
            page.locator("#clip-start").fill("0.5")
            page.locator("#clip-start").press("Tab")
            page.locator("#clip-duration").fill("1")
            page.locator("#clip-duration").press("Tab")
            page.locator("#caption-file").set_input_files(str(subtitle_path))
            page.locator("#import-captions").click()
            try:
                page.wait_for_function(
                    "() => document.querySelector('#caption-list')?.textContent.includes('ترجمة مستوردة')",
                    timeout=5000,
                )
            except Exception as exc:
                failures.append("video studio: SRT import failed: " + str(exc) + "; status=" + page.locator("#studio-status").inner_text())
                return
            imported_caption = page.locator("#caption-list").inner_text()
            if "00:00.0–00:00.7" not in imported_caption or "تم استيراد 1 ترجمة" not in page.locator("#studio-status").inner_text():
                failures.append("video studio: imported SRT timing was not shifted to the selected clip.")
            page.locator("#caption-list .caption-remove").click()
            page.locator("#clip-start").fill("0")
            page.locator("#clip-start").press("Tab")
            page.locator("#clip-duration").fill("1")
            page.locator("#clip-duration").press("Tab")
            page.locator("#caption-start").fill("0")
            page.locator("#caption-end").fill("0.8")
            page.locator("#caption-text").fill("اختبار الترجمة")
            page.locator("#add-caption").click()
            if page.locator("#caption-list li").count() != 1:
                failures.append("video studio: caption was not added to the list.")

            # Overlapping captions would render on top of one another; reject them.
            page.locator("#caption-start").fill("0.2")
            page.locator("#caption-end").fill("0.6")
            page.locator("#caption-text").fill("ترجمة متداخلة")
            page.locator("#add-caption").click()
            if page.locator("#caption-list li").count() != 1:
                failures.append("video studio: overlapping caption was accepted.")
            if "يتداخل" not in page.locator("#studio-status").inner_text():
                failures.append("video studio: overlapping-caption rejection did not explain the timing conflict.")

            # Keep the overlong-text case outside the existing caption interval.
            page.locator("#caption-start").fill("0.8")
            page.locator("#caption-end").fill("1")
            page.locator("#caption-text").fill("كلمة" * 120)
            page.locator("#add-caption").click()
            if page.locator("#caption-list li").count() != 1:
                failures.append("video studio: an overlong burned-in caption was accepted and may be truncated.")
            if "قسّمه" not in page.locator("#studio-status").inner_text():
                failures.append("video studio: overlong caption rejection did not explain how to fix it.")
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
                test_homepage_brand(browser, base_url, failures, page_errors)
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
