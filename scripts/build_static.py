#!/usr/bin/env python3
"""Build public Athar pages and apply the shared visual identity."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

# Never publish the admin UI as a static page: browser-side checks are not an authorization boundary.
# Keep admin.html in the repository for development, but require a server-protected deployment before exposing it.
for page in ROOT.glob("*.html"):
    if page.name == "admin.html":
        continue
    destination = OUT / page.name
    html = page.read_text(encoding="utf-8")
    stylesheet = '<link rel="stylesheet" href="assets/athar-design-system.css">'
    if "athar-design-system.css" not in html:
        if "</head>" in html:
            html = html.replace("</head>", f"  {stylesheet}\n</head>", 1)
        else:
            # Preserve a valid fallback for any legacy page missing a head close.
            html = stylesheet + "\n" + html
    destination.write_text(html, encoding="utf-8")

assets = ROOT / "assets"
if assets.is_dir():
    shutil.copytree(assets, OUT / "assets", dirs_exist_ok=True)

public = ROOT / "public"
if public.is_dir():
    # Public-folder files are served from the site root by Netlify conventions.
    shutil.copytree(public, OUT, dirs_exist_ok=True)

robots = ROOT / "robots.txt"
if robots.exists():
    shutil.copy2(robots, OUT / "robots.txt")

pages = list(OUT.glob("*.html"))
print(f"Built {len(pages)} public HTML pages into {OUT.relative_to(ROOT)}/")
print("Applied the shared Athar light-mode stylesheet to every public HTML page.")
print("Excluded admin.html from public output until server-side authorization is deployed.")
