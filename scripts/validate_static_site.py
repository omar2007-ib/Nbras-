#!/usr/bin/env python3
"""Static smoke checks for Athar before deployment; uses only Python stdlib."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class References(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.attrs = []
        self.lang = None
        self.direction = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang")
            self.direction = attrs.get("dir")
        for key in ("href", "src"):
            value = attrs.get(key)
            if value:
                self.refs.append((tag, key, value))
        self.attrs.append((tag, attrs))


def main():
    build = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_static.py")],
        cwd=ROOT, text=True, capture_output=True,
    )
    if build.returncode:
        print(build.stdout, end="")
        print(build.stderr, file=sys.stderr, end="")
        return build.returncode

    pages = sorted(DIST.glob("*.html"))
    errors = []
    if not pages:
        errors.append("No HTML pages were generated in dist/.")
    if (DIST / "admin.html").exists():
        errors.append("admin.html must not be published until server-side auth/RBAC exists.")

    for page in pages:
        parser = References()
        try:
            html = page.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"{page.name}: file is not UTF-8.")
            continue
        parser.feed(html)
        if parser.direction != "rtl" or parser.lang != "ar":
            errors.append(f"{page.name}: expected <html lang=\"ar\" dir=\"rtl\">.")
        if "assets/athar-design-system.css" not in html:
            errors.append(f"{page.name}: shared Athar design system is missing.")
        if "assets/athar-mark.svg" not in html:
            errors.append(f"{page.name}: brand mark/favicon reference is missing.")

        for tag, attr, raw in parser.refs:
            parts = urlsplit(raw)
            if parts.scheme or parts.netloc or raw.startswith(("data:", "mailto:", "tel:", "javascript:")):
                continue
            path = parts.path
            if not path or path == "/":
                target = DIST / "index.html"
            else:
                target = (DIST / path.lstrip("/")) if path.startswith("/") else (page.parent / path)
            if not target.exists():
                errors.append(f"{page.name}: missing local {attr} target {raw!r}.")

    print(f"Static pages checked: {len(pages)}")
    if errors:
        for error in errors:
            print("FAIL: " + error)
        print(f"Result: FAILED ({len(errors)} issue(s))")
        return 1
    print("Result: PASSED (0 warnings)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
