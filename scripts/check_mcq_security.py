#!/usr/bin/env python3
"""Static regression checks for public MCQ answer-key isolation."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE_MIGRATION = ROOT / "supabase" / "migrations" / "20261021180000_protect_mcq_answer_keys.sql"
VIEW_MIGRATION = ROOT / "supabase" / "migrations" / "20261021182000_make_mcq_public_view_invoker_safe.sql"
ACCESS_MIGRATION = ROOT / "supabase" / "migrations" / "20261021183000_grant_safe_mcq_public_view_reads.sql"


def compact_sql(path: Path) -> str:
    return re.sub(r"\s+", " ", re.sub(r"--[^\n]*", "", path.read_text(encoding="utf-8")).lower())


def main() -> int:
    errors = []
    for path in (BASE_MIGRATION, VIEW_MIGRATION, ACCESS_MIGRATION):
        if not path.is_file():
            errors.append(f"Missing security migration: {path.relative_to(ROOT)}")
    if errors:
        for error in errors:
            print("FAIL: " + error)
        return 1

    base = compact_sql(BASE_MIGRATION)
    view = compact_sql(VIEW_MIGRATION)
    access = compact_sql(ACCESS_MIGRATION)

    if "revoke select on table public.mcq_questions from anon, public" not in base:
        errors.append("Anonymous/PUBLIC roles must not have table-level SELECT.")
    if "create policy staff_mcq_read" not in base or "to authenticated" not in base:
        errors.append("Base-table SELECT policy must be limited to authenticated staff.")
    if "p.role in ('owner', 'admin')" not in base:
        errors.append("Base-table SELECT policy must check owner/admin role.")
    if "create policy mcq_public_read" not in view or "to anon" not in view or "using (status = 'approved')" not in view:
        errors.append("Anonymous RLS policy must expose approved questions only.")
    if "grant select (" not in view or "updated_at ) on table public.mcq_questions to anon" not in view:
        errors.append("Anonymous access must use a safe column-level grant.")
    if "security_invoker = true" not in view:
        errors.append("Public view must run with invoker privileges and RLS.")
    view_match = re.search(
        r"create or replace view public\.mcq_public_questions.*?as select (.*?) from public\.mcq_questions where status = 'approved'",
        view,
    )
    if not view_match:
        errors.append("Answer-free public view must expose approved questions only.")
    elif "correct_index" in view_match.group(1):
        errors.append("Public MCQ view must never expose correct_index.")
    if "grant select on table public.mcq_public_questions to anon, authenticated" not in access:
        errors.append("The safe public view must be readable by learning clients.")
    if "revoke insert, update, delete on table public.mcq_public_questions from anon, authenticated, public" not in access:
        errors.append("Public view access must remain read-only.")

    if errors:
        for error in errors:
            print("FAIL: " + error)
        print(f"Result: FAILED ({len(errors)} issue(s))")
        return 1

    print("MCQ answer-key isolation checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
