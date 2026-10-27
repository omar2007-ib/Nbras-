#!/usr/bin/env python3
"""Regression checks for Athar's Qudrat study-plan schedules and local progress UI."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
JS_PATH = ROOT / "assets" / "qd-study-plan.js"
CSS_PATH = ROOT / "assets" / "qd-study-plan.css"
HTML_PATH = ROOT / "study-plan.html"
errors = []


def require(condition, message):
    if not condition:
        errors.append(message)


def read(path):
    if not path.is_file():
        errors.append(f"Required file is missing: {path.relative_to(ROOT)}")
        return ""
    return path.read_text(encoding="utf-8")


def extract_json_array(source, name):
    match = re.search(rf"const {re.escape(name)} = (\[.*?\]);", source, re.S)
    if not match:
        errors.append(f"Could not locate JSON-compatible array {name}.")
        return []
    try:
        value = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        errors.append(f"{name} is not valid JSON-compatible data: {exc}")
        return []
    if not isinstance(value, list):
        errors.append(f"{name} must be an array.")
        return []
    return value


js = read(JS_PATH)
css = read(CSS_PATH)
html = read(HTML_PATH)
alternating = extract_json_array(js, "alternatingPlan")
sprint = extract_json_array(js, "quantSprint")

require(len(alternating) == 30, "The alternating schedule must contain exactly 30 days.")
require([x.get("day") for x in alternating] == list(range(1, 31)),
        "The alternating schedule must contain each day 1 through 30 exactly once.")
require(len(sprint) == 15, "The intensive quantitative schedule must contain exactly 15 days.")
require([x.get("day") for x in sprint] == list(range(1, 16)),
        "The intensive quantitative schedule must contain each day 1 through 15 exactly once.")

if len(alternating) == 30:
    tracks = [x.get("track") for x in alternating]
    require(all(track in {"quant", "verbal"} for track in tracks),
            "Each alternating day must be categorized as quant or verbal.")
    require(all(tracks[i] != tracks[i - 1] for i in range(1, len(tracks))),
            "The 30-day plan must alternate quantitative and verbal sessions.")
    quant = [x for x in alternating if x.get("track") == "quant"]
    verbal = [x for x in alternating if x.get("track") == "verbal"]
    require(len(quant) == 15 and len(verbal) == 15,
            "The alternating plan must include 15 quantitative and 15 verbal sessions.")
    require([x.get("session") for x in quant] == list(range(1, 16)),
            "Quantitative session numbers must run from 1 to 15.")
    require([x.get("session") for x in verbal] == list(range(1, 16)),
            "Verbal session numbers must run from 1 to 15.")
    require("60 سؤالًا خلال 60 دقيقة" in quant[-1].get("task", ""),
            "The final quantitative session must preserve the 60-question/60-minute target.")

for name, items in (("alternating plan", alternating), ("quant sprint", sprint)):
    for item in items:
        require(bool(item.get("topic", "").strip()), f"{name}: day {item.get('day')} has no topic.")
        require(bool(item.get("task", "").strip()), f"{name}: day {item.get('day')} has no task.")

if len(sprint) == 15:
    require("60 سؤالًا خلال 60 دقيقة" in sprint[-1].get("task", ""),
            "The 15-day sprint must finish with a 60-question/60-minute timed target.")

require('href="assets/qd-study-plan.css"' in html,
        "The study page must load the Qudrat plan stylesheet.")
require('src="assets/qd-study-plan.js"' in html,
        "The study page must load the Qudrat plan behavior.")
for element_id in ("qd-plan-days", "qd-quant-sprint-days", "qd-plan-reset", "qd-plan-status"):
    require(f'id="{element_id}"' in html, f"The study page is missing #{element_id}.")
require("على هذا الجهاز فقط" in html,
        "The interface must clearly disclose that plan progress is device-local.")
require("localStorage" in js and 'const STORAGE_KEY = "athar-qd-study-plan-v1"' in js,
        "Progress must use its own namespaced local-storage key.")
require("Number.isInteger(day) && day >= 1 && day <= max" in js,
        "Persisted day values must be range-checked before rendering.")
require("role=\"progressbar\"" in html and 'aria-live="polite"' in html,
        "Progress and status need accessible semantics.")
require("textContent = item.topic" in js and "textContent = item.task" in js,
        "Schedule text must be inserted with textContent, not interpreted as HTML.")
require("@media(prefers-reduced-motion:reduce)" in css,
        "The plan UI must respect reduced-motion preferences.")
require("min-height:44px" in css,
        "The plan controls must meet the 44px touch-target baseline.")

if errors:
    for error in errors:
        print("FAIL: " + error)
    print(f"Qudrat study-plan regression checks: FAILED ({len(errors)} issue(s))")
    sys.exit(1)

print("Qudrat study-plan regression checks: PASSED")
print("Verified 30 alternating days, 15 intensive quantitative days, session counts, timed-test target, local progress safeguards, and accessibility hooks.")
