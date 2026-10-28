#!/usr/bin/env python3
"""Regression checks for README Markdown formatting and local links."""

from pathlib import Path
import re
import tempfile
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")


def literal_newline_escape_lines(text):
    """Return line numbers containing a literal backslash-n sequence."""
    return [
        line_number
        for line_number, line in enumerate(text.splitlines(), start=1)
        if r"\n" in line
    ]


def broken_relative_links(text, source_path, root):
    """Return issues for broken or root-escaping local Markdown links."""
    root = Path(root).resolve()
    source_path = Path(source_path).resolve()
    issues = []

    for match in MARKDOWN_LINK.finditer(text):
        raw_target = match.group(1).strip()
        if raw_target.startswith("<") and raw_target.endswith(">"):
            raw_target = raw_target[1:-1]
        target = raw_target.split(maxsplit=1)[0] if raw_target else ""
        if not target:
            continue

        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or target.startswith("//"):
            continue

        target_path = unquote(parsed.path)
        if not target_path:
            continue

        if target_path.startswith("/"):
            candidate = (root / target_path.lstrip("/")).resolve()
        else:
            candidate = (source_path.parent / target_path).resolve()

        try:
            candidate.relative_to(root)
        except ValueError:
            issues.append(f"{target}: link escapes repository root")
            continue

        if not candidate.exists():
            issues.append(f"{target}: target does not exist")

    return issues


class MarkdownIntegrityTests(unittest.TestCase):
    def test_readme_has_no_literal_newline_escapes(self):
        text = README.read_text(encoding="utf-8")
        lines = literal_newline_escape_lines(text)
        self.assertEqual([], lines, f"Literal \\n sequence(s) on README line(s): {lines}")

    def test_readme_relative_links_resolve(self):
        text = README.read_text(encoding="utf-8")
        issues = broken_relative_links(text, README, ROOT)
        self.assertEqual([], issues, "Broken README links: " + "; ".join(issues))

    def test_detects_literal_newline_escape(self):
        self.assertEqual([1], literal_newline_escape_lines(r"- first\n- second"))

    def test_ignores_external_and_fragment_links(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "README.md"
            (root / "guide.md").write_text("# Guide", encoding="utf-8")
            text = "[guide](guide.md#intro) [web](https://example.com) [section](#top)"
            self.assertEqual([], broken_relative_links(text, source, root))

    def test_reports_missing_local_link(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "README.md"
            issues = broken_relative_links("[missing](missing.md)", source, root)
            self.assertEqual(1, len(issues))
            self.assertIn("target does not exist", issues[0])

    def test_rejects_links_that_escape_repository_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "repo"
            root.mkdir()
            source = root / "README.md"
            issues = broken_relative_links("[outside](../outside.md)", source, root)
            self.assertEqual(1, len(issues))
            self.assertIn("escapes repository root", issues[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
