#!/usr/bin/env python3
"""Static regression checks for Athar owner QR sign-in."""
from html.parser import HTMLParser
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "assets/auth.js").read_text(encoding="utf-8")
HTML = (ROOT / "auth.html").read_text(encoding="utf-8")
VERCEL = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])

p = Parser()
p.feed(HTML)
headers = {h["key"].lower(): h["value"] for r in VERCEL.get("headers", []) for h in r.get("headers", [])}
policy = headers.get("permissions-policy", "")
checks = {
    "QR URL stays on this origin": "parsed.origin === location.origin" in JS,
    "QR marker is checked on auth page": 'parsed.pathname.endsWith("/auth.html")' in JS and 'parsed.searchParams.get("owner_qr") === OWNER_QR_CODE' in JS,
    "redirect destinations are allow-listed": 'const safe = /^(index|admin|courses|practice|exam|resources|study-plan|mcq-builder)\\.html$/.test(requested)' in JS,
    "email login cannot create accounts": "shouldCreateUser: false" in JS,
    "camera tracks are stopped": "cameraStream.getTracks().forEach(track => track.stop())" in JS,
    "camera is stopped on page exit": 'window.addEventListener("pagehide", stopScanner)' in JS,
    "native scanner falls back to jsQR": "if (detector && window.jsQR) detector = null" in JS,
    "camera permission is same-origin only": "camera=(self)" in policy,
    "microphone and geolocation are disabled": "microphone=()" in policy and "geolocation=()" in policy,
    "all scanner IDs exist once": all(x in p.ids for x in ["owner-qr-code", "owner-qr-status", "start-qr-scan", "stop-qr-scan", "qr-camera", "qr-canvas", "qr-scan-status"]) and len(p.ids) == len(set(p.ids)),
    "QR libraries are referenced": any("qrcode" in x.lower() for x in p.scripts) and any("jsqr" in x.lower() for x in p.scripts),
}
for label, ok in checks.items():
    print(("PASS" if ok else "FAIL") + ": " + label)
failed = [label for label, ok in checks.items() if not ok]
if failed:
    print(f"FAILED: {len(failed)} check(s)")
    sys.exit(1)
print(f"PASSED: {len(checks)} checks")
