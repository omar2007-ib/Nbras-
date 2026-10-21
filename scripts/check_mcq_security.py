#!/usr/bin/env python3
"""Static regression checks for public MCQ answer-key isolation."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20261021180000_protect_mcq_answer_keys.sql"


def main() -> int:
    if not MIGRATION.is_file():
        print(f"FAIL: missing security migration: {MIGRATION.relative_to(ROOT)}")
        return 1

    sql = re.sub(r"--[^\n]*", "", MIGRATION.read_text(encoding="utf-8")).lower()
    compact = re.sub(r"\s+", " ", sql)
    errors = []

    if "revoke select on table public.mcq_questions from anon" not in compact:
        errors.append("Anonymous clients must not SELECT the base question table.")
    if "create policy staff_mcq_read" not in compact or "to authenticated" not in compact:
        errors.append("Base-table SELECT policy must be limited to authenticated staff.")
    if "p.role in ('owner', 'admin')" not in compact:
        errors.append("Base-table SELECT policy must check owner/admin role.")
    view_match = re.search(
        r"create or replace view public\.mcq_public_questions.*?as select (.*?) from public\.mcq_questions where status = 'approved'",
        compact,
    )
    if not view_match:
        errors.append("Answer-free public view must expose approved questions only.")
    elif "correct_index" in view_match.group(1):
        errors.append("Public MCQ view must never expose correct_index.")
    if "grant select on table public.mcq_public_questions to anon, authenticated" not in compact:
        errors.append("Public view must be readable by public learning clients.")

    if errors:
        for error in errors:
            print("FAIL: " + error)
        print(f"Result: FAILED ({len(errors)} issue(s))")
        return 1

    print("MCQ answer-key isolation checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
