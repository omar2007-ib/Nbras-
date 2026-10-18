# scripts/check_site.py

#!/usr/bin/env python3
"""Dependency-free static checks for the Athar HTML site."""
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
IGNORE_SCHEMES = ("http:", "https:", "mailto:", "tel:", "data:", "javascript:", "blob:")
errors, warnings = [], []

class PageParser(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = set()
        self.links = []
        self.images = []
        self.labels_for = set()
        self.inputs = []
        self.title_seen = False
        self.lang_ar = False
        self.dir_rtl = False
        self.viewport = False
        self.current_title = False
        self.title_text = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang_ar = a.get("lang") == "ar"
            self.dir_rtl = a.get("dir") == "rtl"
        if tag == "meta" and a.get("name", "").lower() == "viewport":
            self.viewport = True
        if tag == "title":
            self.title_seen = True
            self.current_title = True
        if a.get("id"):
            self.ids.add(a["id"])
        if tag in ("a", "link", "script", "img", "source") and a.get("href" if tag in ("a", "link") else "src"):
            attr = "href" if tag in ("a", "link") else "src"
            self.links.append((tag, attr, a[attr]))
        if tag == "img":
            self.images.append(a)
        if tag == "label" and a.get("for"):
            self.labels_for.add(a["for"])
        if tag == "input" and a.get("type", "").lower() not in ("hidden", "submit", "button", "reset", "image"):
            self.inputs.append(a)

    def handle_endtag(self, tag):
        if tag == "title":
            self.current_title = False

    def handle_data(self, data):
        if self.current_title:
            self.title_text += data.strip()

def rel_path(page, raw):
    raw = raw.strip()
    if not raw or raw == "#":
        return None, None
    if raw.startswith(IGNORE_SCHEMES) or raw.startswith("//"):
        return None, None
    path_part, _, fragment = raw.partition("#")
    path_part = path_part.split("?", 1)[0]
    if not path_part:
        return page, fragment or None
    # Root-relative URLs are served from the site root. In this repository,
    # static-site assets under public/ are also exposed at that root.
    if path_part.startswith("/"):
        site_path = path_part.lstrip("/")
        target = (ROOT / site_path).resolve()
        if not target.exists() and (ROOT / "public" / site_path).exists():
            target = (ROOT / "public" / site_path).resolve()
    else:
        target = (page.parent / path_part).resolve()
    try:
        target.relative_to(ROOT.resolve())
    except ValueError:
        return None, "PATH_ESCAPES_ROOT"
    return target, fragment or None

pages = sorted(p for p in ROOT.rglob("*.html") if not any(part in {".git", "node_modules", ".next", "dist", "build"} for part in p.relative_to(ROOT).parts))
if not pages:
    errors.append("No HTML pages found.")

parsed = {}
for page in pages:
    rel = page.relative_to(ROOT)
    parser = PageParser(page)
    try:
        parser.feed(page.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{rel}: HTML parsing failed: {exc}")
        continue
    parsed[page.resolve()] = parser
    if not parser.lang_ar:
        errors.append(f"{rel}: expected <html lang=\"ar\">.")
    if not parser.dir_rtl:
        errors.append(f"{rel}: expected <html dir=\"rtl\">.")
    if not parser.viewport:
        errors.append(f"{rel}: missing viewport meta.")
    if not parser.title_seen or not parser.title_text:
        warnings.append(f"{rel}: missing or empty <title>.")
    for img in parser.images:
        if "alt" not in img:
            errors.append(f"{rel}: image missing alt attribute.")
    for field in parser.inputs:
        if field.get("id") and field["id"] not in parser.labels_for:
            # Allow aria-label / aria-labelledby as accessible alternatives.
            if not field.get("aria-label") and not field.get("aria-labelledby"):
                warnings.append(f"{rel}: input #{field['id']} has no associated <label> or aria-label.")

for page, parser in parsed.items():
    rel = page.relative_to(ROOT)
    for tag, attr, raw in parser.links:
        target, fragment = rel_path(page, raw)
        if target is None:
            if fragment == "PATH_ESCAPES_ROOT":
                errors.append(f"{rel}: {attr} path escapes repository root: {raw}")
            continue
        if not target.exists():
            errors.append(f"{rel}: broken local {attr}: {raw}")
            continue
        if fragment and target.is_file() and target.suffix.lower() == ".html" and target.resolve() in parsed:
            if fragment not in parsed[target.resolve()].ids:
                errors.append(f"{rel}: missing fragment target in {raw}")

# Focused feature-presence checks for the manual MCQ builder.
mcq_path = ROOT / "mcq-builder.html"
if not mcq_path.exists():
    errors.append("Missing mcq-builder.html.")
else:
    mcq = mcq_path.read_text(encoding="utf-8")
    required_mcq_features = {
        "question form": 'id="question-form"',
        "fourth option": 'id="option3"',
        "correct-answer selector": 'id="correct"',
        "JSON export": 'id="export-json"',
        "CSV export": 'id="export-csv"',
        "JSON import": 'id="import-file"',
        "clear-all confirmation action": 'id="clear-all"',
        "browser-local persistence": "localStorage",
    }
    for label, token in required_mcq_features.items():
        if token not in mcq:
            errors.append(f"MCQ builder missing {label}.")

print(f"Athar static site check: {len(pages)} HTML pages scanned.")
for item in warnings:
    print("WARNING:", item)
for item in errors:
    print("ERROR:", item)
if errors:
    print(f"FAILED: {len(errors)} error(s), {len(warnings)} warning(s).")
    sys.exit(1)
print(f"PASSED: no broken local links or required RTL/viewport errors. Warnings: {len(warnings)}.")