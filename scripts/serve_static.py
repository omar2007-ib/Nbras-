#!/usr/bin/env python3
"""Static preview server with clean URL support."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import os

ROOT = (Path(__file__).resolve().parents[1] / "dist").resolve()

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).lstrip("/")
        target = (ROOT / relative).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            return str(ROOT / "__not_found__")
        if target.is_dir() and (target / "index.html").is_file():
            return str(target / "index.html")
        if not target.exists() and not target.suffix:
            candidate = target.with_suffix(".html")
            if candidate.is_file():
                return str(candidate)
        return str(target)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving built Athar site on port {port}", flush=True)
    server.serve_forever()
