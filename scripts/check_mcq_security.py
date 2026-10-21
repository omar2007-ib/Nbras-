#!/usr/bin/env python3
"""Static regression checks for public MCQ answer-key isolation."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE_MIGRATION = ROOT / "supabase" / "migrations" / "20261021180000_protect_mcq_answer_keys.sql"
VIEW_MIGRATION = ROOT / "supabase" / "migrations" / "20261021182000_make_mcq_public_view_invoker_safe.sql"
ACCESS_MIGRATION = ROOT / "supabase" / "migrations" / "20261021183000_grant_safe_mcq_public_view_reads.sql"
PUBLIC_API_MIGRATION = ROOT / "supabase" / "migrations" / "20261021184000_hide_mcq_explanations_from_public_api.sql"
PUBLIC_VIEW_GRANTS_MIGRATION = ROOT / "supabase" / "migrations" / "20261021184100_revoke_public_mcq_view_mutations.sql"
SAFE_COLUMNS_MIGRATION = ROOT / "supabase" / "migrations" / "20261021185000_grant_safe_mcq_base_columns.sql"
RATE_LIMIT_MIGRATION = ROOT / "supabase" / "migrations" / "20261021143028_athar_assistant_persistent_rate_limit.sql"
RATE_LIMIT_POLICY_MIGRATION = ROOT / "supabase" / "migrations" / "20261021143142_rate_limit_explicit_deny_policy.sql"
ASSISTANT_FUNCTION = ROOT / "supabase" / "functions" / "athar-assistant" / "index.ts"


def compact_sql(path: Path) -> str:
    return re.sub(r"\s+", " ", re.sub(r"--[^\n]*", "", path.read_text(encoding="utf-8")).lower())


def main() -> int:
    errors = []
    for path in (BASE_MIGRATION, VIEW_MIGRATION, ACCESS_MIGRATION, PUBLIC_API_MIGRATION, PUBLIC_VIEW_GRANTS_MIGRATION, SAFE_COLUMNS_MIGRATION, RATE_LIMIT_MIGRATION, RATE_LIMIT_POLICY_MIGRATION, ASSISTANT_FUNCTION):
        if not path.is_file():
            errors.append(f"Missing security migration: {path.relative_to(ROOT)}")
    if errors:
        for error in errors:
            print("FAIL: " + error)
        return 1

    base = compact_sql(BASE_MIGRATION)
    view = compact_sql(VIEW_MIGRATION)
    access = compact_sql(ACCESS_MIGRATION)
    public_api = compact_sql(PUBLIC_API_MIGRATION)
    public_view_grants = compact_sql(PUBLIC_VIEW_GRANTS_MIGRATION)
    safe_columns = compact_sql(SAFE_COLUMNS_MIGRATION)
    rate_limit = compact_sql(RATE_LIMIT_MIGRATION)
    rate_limit_policy = compact_sql(RATE_LIMIT_POLICY_MIGRATION)
    assistant = compact_sql(ASSISTANT_FUNCTION)

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

    if "create view public.mcq_public_questions" not in public_api or "security_invoker = true" not in public_api:
        errors.append("Final public MCQ view must use invoker privileges.")
    public_view_match = re.search(
        r"create view public\.mcq_public_questions.*?as select (.*?) from public\.mcq_questions where status = 'approved'",
        public_api,
    )
    if not public_view_match:
        errors.append("Final public MCQ view definition must be present.")
    elif any(secret in public_view_match.group(1) for secret in ("correct_index", "explanation", "source_name", "status")):
        errors.append("Final public MCQ view must not expose answer keys, explanations, or internal metadata.")
    if "revoke select (explanation, source_name, status) on table public.mcq_questions from anon" not in public_api:
        errors.append("Anonymous clients must not read explanations or internal MCQ metadata directly.")
    if "revoke all on table public.mcq_public_questions from public, anon, authenticated, service_role" not in public_view_grants:
        errors.append("Recreated public MCQ view must not inherit broad default grants.")
    if "grant select on table public.mcq_public_questions to anon, authenticated" not in public_view_grants:
        errors.append("The final public MCQ view must grant SELECT only to learning clients.")
    if "grant select (id, question, options, category, difficulty, created_at, updated_at) on table public.mcq_questions to anon" not in safe_columns:
        errors.append("Security-invoker view must grant only the safe underlying columns to anonymous learners.")
    if any(secret in safe_columns for secret in ("correct_index", "explanation", "source_name", "status")):
        errors.append("Anonymous base-table column grants must exclude answer keys and internal metadata.")
    if "create or replace function public.consume_athar_assistant_rate_limit" not in rate_limit:
        errors.append("Durable server-side assistant rate limiter migration is missing.")
    if "grant execute on function public.consume_athar_assistant_rate_limit(text, integer, integer) to service_role" not in rate_limit:
        errors.append("Only service_role should execute the durable rate limiter.")
    if "using (false)" not in rate_limit_policy or "with check (false)" not in rate_limit_policy:
        errors.append("Rate-limit table must explicitly deny client RLS access.")
    if "hmacsha256" not in assistant or "12, 60" not in assistant or "150, 86400" not in assistant:
        errors.append("Assistant must use HMAC-keyed durable minute and daily rate limits.")
    if "fail closed" not in assistant or "retry-after" not in assistant:
        errors.append("Rate limiting must fail closed and return Retry-After when throttled.")

    if '"https://athar-learning-platform.vercel.app"' not in assistant:
        errors.append("The production Vercel origin must be allowlisted for assistant CORS.")

    if errors:
        for error in errors:
            print("FAIL: " + error)
        print(f"Result: FAILED ({len(errors)} issue(s))")
        return 1

    print("MCQ answer-key isolation checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
