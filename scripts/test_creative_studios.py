#!/usr/bin/env python3
"""Dependency-free regression checks for Athar's local creative studios."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = 0

def require(condition, message):
    global checks
    checks += 1
    if not condition:
        errors.append(message)

video_html = (ROOT / "video-studio.html").read_text(encoding="utf-8")
design_html = (ROOT / "design-studio.html").read_text(encoding="utf-8")
index_html = (ROOT / "index.html").read_text(encoding="utf-8")
video_js = (ROOT / "assets" / "athar-video-studio.js").read_text(encoding="utf-8")
subtitle_parser = (ROOT / "assets" / "athar-subtitle-parser.js").read_text(encoding="utf-8")
design_js = (ROOT / "assets" / "athar-design-studio.js").read_text(encoding="utf-8")
video_css = (ROOT / "assets" / "athar-video-studio.css").read_text(encoding="utf-8")
design_css = (ROOT / "assets" / "athar-design-studio.css").read_text(encoding="utf-8")
premium_css = (ROOT / "assets" / "athar-premium.css").read_text(encoding="utf-8")

for name, page in (("video-studio.html", video_html), ("design-studio.html", design_html)):
    require('<html lang="ar" dir="rtl">' in page, f"{name}: Arabic RTL document attributes are required.")
    require('assets/athar-design-system.css' in page, f"{name}: shared Athar design system is required.")
    require('assets/athar-mark.svg' in page, f"{name}: favicon reference is required.")
    header = page.split("</header>", 1)[0]
    require("<img" not in header, f"{name}: the wordmark must be text-only, without a separate symbol.")
    require('aria-label="القائمة الرئيسية"' in page, f"{name}: navigation needs an accessible label.")
    require('role="status" aria-live="polite"' in page, f"{name}: user feedback must be announced accessibly.")

require('href="video-studio.html"' in index_html, "Homepage must link to the video studio.")
require('href="design-studio.html"' in index_html, "Homepage must link to the design studio.")
require('id="video-file"' in video_html and 'id="export-short"' in video_html, "Video studio must expose the file picker and export action.")
require("MediaRecorder" in video_js and "captureStream" in video_js, "Video export must use real browser media recording.")
require("async function captureSourceAudio()" in video_js and "createMediaStreamDestination" in video_js and "fallbackAudioSource.connect(fallbackAudioContext.destination)" in video_js, "Video export must preserve audio on browsers without HTMLMediaElement.captureStream.")
require("لم يتم إنشاء ملف ناقص الصوت" in video_js and "لم يتمكن المتصفح من تجهيز مسار صوت" in video_js, "Video export must fail clearly rather than silently dropping audio.")
require("getImageData" in video_js and "meanFrameDifference" in video_js, "Scene suggestions must inspect real video frames.")
require('id="caption-file"' in video_html and 'id="import-captions"' in video_html, "Video studio must expose SRT/VTT import controls.")
require("AtharSubtitleParser" in video_js and "clipToRange" in video_js, "Imported subtitle timings must be mapped to the selected clip.")
require("MAX_IMPORTED_SUBTITLE_BYTES" in video_js and "MAX_IMPORTED_CAPTIONS = 500" in video_js, "Subtitle import must enforce file and cue-count limits.")
require("function parseTimestamp" in subtitle_parser and "function clipToRange" in subtitle_parser, "Subtitle parser must expose timestamp parsing and range clipping.")
require("<img" not in index_html.split("</header>", 1)[0], "Homepage wordmark must be text-only without a separate symbol.")
require("fileInput.disabled = true;" in video_js[video_js.index("async function detectSceneChanges()"):video_js.index("function renderSceneSuggestions()")], "Scene scanning must prevent replacing the source file while the scanner is reading its object URL.")
require("fileInput.disabled = false;" in video_js[video_js.index("async function detectSceneChanges()"):video_js.index("function renderSceneSuggestions()")], "Scene scanning must re-enable file selection after completion or an unsupported canvas context.")
require("let fileLoadGeneration = 0;" in video_js and "const loadGeneration = ++fileLoadGeneration;" in video_js, "Video file selection must assign a generation token so rapid selections cannot race.");
require("function waitForMediaEvent(media, eventName, timeoutMs = 15000)" in video_js and "window.clearTimeout(timeoutId);" in video_js and "استغرق المتصفح وقتًا طويلًا في قراءة الفيديو" in video_js, "Media event waits must time out and clean up listeners instead of leaving the studio stuck loading forever.");
require("if (loadGeneration !== fileLoadGeneration) return;" in video_js and "Ignore errors from an older selection" in video_js, "Stale metadata success or failure must not overwrite the newest selected video.")
require('revokeUrl(sourceUrl);\n      sourceUrl = null;\n      sourceVideo.pause();\n      sourceVideo.removeAttribute("src");\n      sourceVideo.load();' in video_js[video_js.index('Ignore errors from an older selection'):video_js.index('function handleClipBoundsChange()')], "A latest-selection metadata failure must release its object URL and clear the unusable media source.");
require("buildSrt" in video_js and "srtTimestamp" in video_js, "Subtitle export must generate timed SRT content.")
require("drawActiveCaption" in video_js and "drawCover" in video_js, "Export must crop to a vertical frame and render captions.")
require("if (!layout) { context.restore(); return; }" in video_js, "Caption rendering must restore canvas state when a caption cannot be drawn.")
require("MAX_CAPTION_LINES = 4" in video_js and "captionLayout" in video_js and "return lines.slice(0, 3)" not in video_js, "Burned-in captions must fit the visible area instead of silently truncating after three lines.")
require("const overlapsExisting = captions.some((caption) => start < caption.end && end > caption.start);" in video_js, "The video studio must reject overlapping caption intervals before adding them.");
require("const overlap = ordered.find((caption, index) => index > 0 && caption.start < ordered[index - 1].end);" in video_js, "Video export validation must reject overlapping captions even if invalid state is introduced.");
require(not re.search(r"\bfetch\s*\(", video_js), "Local video processing must not upload or fetch user video data.")
require("XMLHttpRequest" not in video_js and "FormData" not in video_js, "Video studio must not contain upload transport code.")
require("250 * 1024 * 1024" in video_js, "Video studio must enforce the documented input-size limit.")
require("MAX_CLIP_SECONDS = 180" in video_js, "Video studio must enforce the documented clip-duration limit.")
require("function handleClipBoundsChange()" in video_js and "resetOutput();" in video_js and 'addEventListener("change", handleClipBoundsChange)' in video_js, "Changing clip bounds must invalidate an existing export so stale video cannot be downloaded.")
require('setStatus(error.message, "error");' in video_js and "clipBounds();" in video_js[video_js.index("function handleClipBoundsChange()"):video_js.index('startInput.addEventListener("change", handleClipBoundsChange)')], "Changing clip bounds must surface invalid-range errors instead of silently accepting them.")
require("resetOutput();" in video_js[video_js.index("function renderSceneSuggestions()"):video_js.index('detectButton.addEventListener("click", detectSceneChanges)')], "Choosing a scene suggestion must invalidate a previously exported clip because programmatic input changes do not fire change events.")

require('id="download-svg"' in design_html and 'id="download-png"' in design_html, "Design studio must expose SVG and PNG export controls.")
require("image/svg+xml" in design_js and "image/png" in design_js, "Design studio must generate real SVG and PNG files.")
require("escapeXml" in design_js, "User-entered design text must be escaped before being written into SVG.")
require("return lines.slice(0, maxLines)" not in design_js, "Design copy must not be silently truncated when it exceeds the template.");
require("titleLines.length > 4" in design_js and "bodyLines.length > 5" in design_js, "Design studio must reject text overflow with an explicit user-facing error.");
require('href="assets/athar-premium.css"' in index_html, "Homepage must load the approved Athar premium palette and text-only wordmark layer.");
require("URL.createObjectURL" in design_js, "Design preview/export must use local Blob URLs.")
require('if (previewUrl) URL.revokeObjectURL(previewUrl);\n      previewUrl = "";\n      preview.replaceChildren();' in design_js, "A rejected design must clear its stale preview and revoke the previous Blob URL.")
require("#5B21B6" in design_js and "#C4B5FD" in design_js, "Design output must use the approved Athar palette.")
require("licensedFontAssetBundled: false" in design_js, "The design studio must not falsely claim the licensed Jazeel font is bundled.")

require("#5B21B6" in premium_css and "#C4B5FD" in premium_css, "Shared visual identity must use the approved purple palette.")
require('font-family:"Jazeel"' in premium_css, "Wordmark styling must prefer the approved Jazeel typeface.")
require("header .logo img" in premium_css and "display:none!important" in premium_css, "Shared wordmark must not display a separate icon.")
require("#5B21B6" in video_css and "#C4B5FD" in video_css, "Video studio must use the approved Athar palette.")
require("#5B21B6" in design_css and "#C4B5FD" in design_css, "Design studio must use the approved Athar palette.")

if errors:
    for error in errors:
        print("FAIL: " + error)
    print(f"Result: FAILED ({len(errors)} issue(s))")
    raise SystemExit(1)

print(f"Creative studio regression checks: {checks} assertions passed.")
