#!/usr/bin/env python3
"""Regression checks for resilient admin publish/delete actions."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "assets" / "admin.js").read_text(encoding="utf-8")

def function_body(name, next_name):
    start = SOURCE.find(f"async function {name}(")
    if start < 0:
        raise ValueError(f"Missing function: {name}")
    end = SOURCE.find(f"async function {next_name}(", start + 1)
    if end < 0:
        raise ValueError(f"Missing next function boundary: {next_name}")
    return SOURCE[start:end]

publish = function_body("setPublished", "removeRow")
delete = function_body("removeRow", "download")
checks = {
    "publish failures are caught and shown": "catch (error)" in publish and "تعذر تحديث حالة النشر" in publish,
    "publish button always recovers in finally": "finally" in publish and "button.disabled = false" in publish,
    "delete failures are caught and shown": "catch (error)" in delete and "تعذر إكمال حذف المحتوى" in delete,
    "delete button always recovers in finally": "finally" in delete and "button.disabled = false" in delete,
    "delete keeps the database record if storage removal returns an error": "if (storageError)" in delete and "احتفظنا بسجل المحتوى" in delete,
    "database deletion errors are reported separately": "if (deleteError)" in delete and "تعذر حذف سجل المكتبة" in delete,
    "publish still updates timestamp": "updated_at: new Date().toISOString()" in publish,
    "destructive deletion still requires confirmation": 'confirm("هل تريد حذف هذا المحتوى نهائيًا؟ لا يمكن التراجع عن الحذف.")' in delete,
}
for label, ok in checks.items():
    print(("PASS" if ok else "FAIL") + ": " + label)
failed = [label for label, ok in checks.items() if not ok]
if failed:
    print(f"FAILED: {len(failed)} check(s)")
    sys.exit(1)
print(f"PASSED: {len(checks)} checks")
