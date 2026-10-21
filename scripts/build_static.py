#!/usr/bin/env python3
"""Build public Athar pages and apply the shared visual identity."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

# Admin UI is included because its data operations are enforced by Supabase RLS and private Storage policies.
# The browser-side role check is only a UX guard; backend policies remain the authorization boundary.
for page in ROOT.glob("*.html"):
    destination = OUT / page.name
    html = page.read_text(encoding="utf-8")
    stylesheet = '<link rel="stylesheet" href="assets/athar-design-system.css">'
    premium_stylesheet = '<link rel="stylesheet" href="assets/athar-premium.css">'
    if "athar-design-system.css" not in html:
        if "</head>" in html:
            html = html.replace("</head>", f"  {stylesheet}\n</head>", 1)
        else:
            # Preserve a valid fallback for any legacy page missing a head close.
            html = stylesheet + "\n" + html
    # Load the premium responsive layer last so it consistently wins over legacy page CSS.
    if "athar-premium.css" not in html:
        if "</head>" in html:
            html = html.replace("</head>", f"  {premium_stylesheet}\n</head>", 1)
        else:
            html = premium_stylesheet + "\n" + html
    assistant_scripts = '<script defer src="assets/supabase-config.js"></script>\n<script defer src="assets/athar-assistant.js"></script>'
    if "assets/athar-assistant.js" not in html and "</body>" in html:
        html = html.replace("</body>", f"{assistant_scripts}\n</body>", 1)

    destination.write_text(html, encoding="utf-8")

assets = ROOT / "assets"
if assets.is_dir():
    shutil.copytree(assets, OUT / "assets", dirs_exist_ok=True)

public = ROOT / "public"
if public.is_dir():
    # Public-folder files are served from the site root by Netlify conventions.
    shutil.copytree(public, OUT, dirs_exist_ok=True)

# Publish only the specific non-secret guide linked from the public LLM provider page.
llm_guide = ROOT / "docs" / "implementation" / "llm-provider-gateway.md"
if llm_guide.exists():
    guide_out = OUT / "docs" / "implementation"
    guide_out.mkdir(parents=True, exist_ok=True)
    shutil.copy2(llm_guide, guide_out / llm_guide.name)

robots = ROOT / "robots.txt"
if robots.exists():
    shutil.copy2(robots, OUT / "robots.txt")

pages = list(OUT.glob("*.html"))
print(f"Built {len(pages)} public HTML pages into {OUT.relative_to(ROOT)}/")
print("Applied the shared Athar light-mode stylesheet to every public HTML page.")
print("Included admin.html; data access remains protected by Supabase RLS and Storage policies.")
