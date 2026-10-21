#!/usr/bin/env python3
"""Regression checks for malformed and unsafe MCQ provider responses."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "supabase" / "functions" / "generate-mcq" / "index.ts").read_text(encoding="utf-8")
checks = {
    "provider JSON parsing is guarded": "try {\n    completion = await aiResponse.json();" in SOURCE,
    "missing provider content returns a controlled 502": 'typeof completionText !== "string" || !completionText.trim()' in SOURCE,
    "parsed null and non-object payloads are rejected": 'if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))' in SOURCE,
    "null and array question entries are filtered safely": 'q && typeof q === "object" && !Array.isArray(q)' in SOURCE,
    "question length is bounded": "q.question.length <= 1500" in SOURCE,
    "option lengths are bounded": "v.length <= 500" in SOURCE,
    "duplicate answer choices are rejected": "new Set(q.options.map" in SOURCE and ".size === 4" in SOURCE,
    "explanations are length bounded": 'q.explanation.trim().slice(0, 2500)' in SOURCE,
    "provider output tokens are bounded on both attempts": SOURCE.count("max_tokens: 6000") == 2,
    "existing staff authorization remains enforced": '["owner", "admin"].includes(profiles[0].role)' in SOURCE,
}
failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(("PASS" if passed else "FAIL") + ": " + name)
if failed:
    raise SystemExit(f"Result: FAILED ({len(failed)} issue(s))")
print(f"Result: PASSED ({len(checks)} checks)")
