#!/usr/bin/env python3
"""Build only public Athar site files into dist/ for static hosting."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

# Admin is intentionally excluded: the current admin screen is a prototype
# with no server-side authentication or authorization.
for page in ROOT.glob("*.html"):
    if page.name == "admin.html":
        continue
    shutil.copy2(page, OUT / page.name)

for directory in ("assets", "public"):
    source = ROOT / directory
    if source.is_dir():
        shutil.copytree(source, OUT, dirs_exist_ok=True)

robots = ROOT / "robots.txt"
if robots.exists():
    shutil.copy2(robots, OUT / "robots.txt")

print(f"Built {len(list(OUT.glob('*.html')))} public HTML pages into {OUT.relative_to(ROOT)}/")
print("Excluded admin.html because the prototype is not protected by server-side authorization.")
