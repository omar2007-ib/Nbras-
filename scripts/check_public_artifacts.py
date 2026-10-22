#!/usr/bin/env python3
"""Fail the static-site release if private artifacts or high-confidence secrets enter dist/."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PUBLIC_ROOT = ROOT / "dist"

FORBIDDEN_SUFFIXES = {".sql", ".pem", ".p12", ".pfx", ".key", ".dump", ".sqlite", ".db"}
FORBIDDEN_NAMES = {".env", ".env.local", ".env.production", ".env.development", "id_rsa", "id_ed25519"}
FORBIDDEN_DIRECTORIES = {".git", "node_modules", "migrations", "functions"}
SECRET_PATTERNS = (
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")),
    ("openai-style-key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")),
    ("supabase-secret-key", re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}\b")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("service-role-key-assignment", re.compile(
        r"""\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*["'][^"']{12,}["']""",
        re.IGNORECASE,
    )),
)


def scan_public_tree(public_root: Path) -> list[str]:
    """Return safe, value-free diagnostics for unsafe files or embedded credentials."""
    if not public_root.is_dir():
        return [f"Public output directory does not exist: {public_root}"]

    root = public_root.resolve()
    errors: list[str] = []
    for path in sorted(public_root.rglob("*")):
        relative = path.relative_to(public_root).as_posix()
        if path.is_symlink():
            errors.append(f"{relative}: symbolic links are not allowed in static output.")
            continue
        if not path.is_file():
            continue

        lower_name = path.name.lower()
        if lower_name.startswith(".env") or lower_name in FORBIDDEN_NAMES:
            errors.append(f"{relative}: environment or private-key file must not be published.")
        if path.suffix.lower() in FORBIDDEN_SUFFIXES:
            errors.append(f"{relative}: private/database artifact type must not be published.")
        if any(part.lower() in FORBIDDEN_DIRECTORIES for part in path.parts):
            errors.append(f"{relative}: development/server-only directory must not be published.")

        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(root)
        except (OSError, ValueError):
            errors.append(f"{relative}: file resolves outside the public output directory.")
            continue

        try:
            content = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        for rule, pattern in SECRET_PATTERNS:
            if pattern.search(content):
                # Never print the matched content: diagnostics expose only the rule and path.
                errors.append(f"{relative}: possible credential detected ({rule}).")

    return errors


def main() -> int:
    errors = scan_public_tree(DEFAULT_PUBLIC_ROOT)
    if errors:
        for error in errors:
            print("FAIL: " + error)
        print(f"Public artifact guard: FAILED ({len(errors)} issue(s)).")
        return 1
    print("Public artifact guard: PASSED (no forbidden artifacts or high-confidence credential patterns).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
