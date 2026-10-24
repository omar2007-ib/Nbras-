#!/usr/bin/env python3
"""Unit tests for Athar's dependency-free accessible-name audit."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_accessible_names import audit_html, audit


class AccessibleNameTests(unittest.TestCase):
    def test_text_aria_labelledby_native_label_and_image_alt_pass(self):
        html = """
        <button>ابدأ</button>
        <a href="/courses.html">الدورات</a>
        <button aria-label="إغلاق"></button>
        <span id="settings-name">الإعدادات</span>
        <button aria-labelledby="settings-name"></button>
        <label for="email">البريد الإلكتروني</label>
        <input id="email" placeholder="لا يُعد بديلاً عن التسمية">
        <button><img src="save.svg" alt="حفظ"></button>
        """
        self.assertEqual(audit_html(html), [])

    def test_unlabelled_controls_and_placeholder_only_fail(self):
        html = '<button></button><a href="/x"></a><input id="q" placeholder="بحث">'
        errors = audit_html(html, "fixture.html")
        self.assertEqual(len(errors), 3)
        self.assertTrue(all("no accessible name" in error for error in errors))

    def test_missing_labelledby_reference_is_reported(self):
        errors = audit_html('<button aria-labelledby="missing">حفظ</button>', "fixture.html")
        self.assertEqual(len(errors), 1)
        self.assertIn("missing aria-labelledby", errors[0])

    def test_title_and_submit_value_are_accepted(self):
        html = '<button title="إعدادات"></button><input type="submit" value="إرسال">'
        self.assertEqual(audit_html(html), [])

    def test_hidden_controls_are_ignored(self):
        self.assertEqual(audit_html('<input type="hidden"><button hidden></button>'), [])

    def test_select_and_textarea_content_is_not_mistaken_for_a_label(self):
        html = '<select><option>اختر</option></select><textarea>قيمة ابتدائية</textarea>'
        self.assertEqual(len(audit_html(html)), 2)

    def test_wrapping_label_works_without_control_id(self):
        self.assertEqual(audit_html('<label>البريد <input type="email"></label>'), [])

    def test_root_scan_excludes_build_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text('<button>حفظ</button>', encoding="utf-8")
            (root / "dist").mkdir()
            (root / "dist" / "generated.html").write_text(
                '<button></button>', encoding="utf-8"
            )
            count, errors = audit(root)
            self.assertEqual(count, 1)
            self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
