#!/usr/bin/env python3
"""Dependency-free regression checks for Athar's local creative studios."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

video_html = (ROOT / "video-studio.html").read_text(encoding="utf-8")
design_html = (ROOT / "design-studio.html").read_text(encoding="utf-8")
index_html = (ROOT / "index.html").read_text(encoding="utf-8")
video_js = (ROOT / "assets" / "athar-video-studio.js").read_text(encoding="utf-8")
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
require("getImageData" in video_js and "meanFrameDifference" in video_js, "Scene suggestions must inspect real video frames.")
require("buildSrt" in video_js and "srtTimestamp" in video_js, "Subtitle export must generate timed SRT content.")
require("drawActiveCaption" in video_js and "drawCover" in video_js, "Export must crop to a vertical frame and render captions.")
require(not re.search(r"\bfetch\s*\(", video_js), "Local video processing must not upload or fetch user video data.")
require("XMLHttpRequest" not in video_js and "FormData" not in video_js, "Video studio must not contain upload transport code.")
require("250 * 1024 * 1024" in video_js, "Video studio must enforce the documented input-size limit.")
require("MAX_CLIP_SECONDS = 180" in video_js, "Video studio must enforce the documented clip-duration limit.")

require('id="download-svg"' in design_html and 'id="download-png"' in design_html, "Design studio must expose SVG and PNG export controls.")
require("image/svg+xml" in design_js and "image/png" in design_js, "Design studio must generate real SVG and PNG files.")
require("escapeXml" in design_js, "User-entered design text must be escaped before being written into SVG.")
require("URL.createObjectURL" in design_js, "Design preview/export must use local Blob URLs.")
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

print("Creative studio regression checks: 34 assertions passed.")
