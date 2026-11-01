#!/usr/bin/env python3
"""Regression tests for the public static-build artifact guard."""
from pathlib import Path
import tempfile
import unittest

from check_public_artifacts import scan_public_tree


class PublicArtifactGuardTests(unittest.TestCase):
    def test_clean_public_tree_passes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "index.html").write_text("<h1>Athar</h1>", encoding="utf-8")
            (root / "assets").mkdir()
            (root / "assets" / "site.css").write_text("body{}", encoding="utf-8")
            self.assertEqual([], scan_public_tree(root))

    def test_environment_files_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".env.production").write_text("NOT_A_REAL_SECRET=placeholder", encoding="utf-8")
            errors = scan_public_tree(root)
            self.assertTrue(any("environment or private-key file" in item for item in errors))

    def test_private_database_artifacts_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "backup.sql").write_text("-- schema", encoding="utf-8")
            errors = scan_public_tree(root)
            self.assertTrue(any("private/database artifact type" in item for item in errors))

    def test_high_confidence_credentials_are_reported_without_echoing_value(self):
        fake_key = "ghp_" + "A" * 36
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "app.js").write_text("const token = '" + fake_key + "';", encoding="utf-8")
            errors = scan_public_tree(root)
            self.assertTrue(any("possible credential detected (github-token)" in item for item in errors))
            self.assertNotIn(fake_key, " ".join(errors))

    def test_server_only_directories_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            private = root / "functions"
            private.mkdir()
            (private / "handler.ts").write_text("export default 1", encoding="utf-8")
            errors = scan_public_tree(root)
            self.assertTrue(any("server-only directory" in item for item in errors))

    def test_missing_public_directory_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            missing = Path(temp) / "dist"
            errors = scan_public_tree(missing)
            self.assertEqual(1, len(errors))
            self.assertIn("does not exist", errors[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
