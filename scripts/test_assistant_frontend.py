#!/usr/bin/env python3
"""Regression checks for timeout handling and assistant chat history."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "assets" / "athar-assistant.js").read_text(encoding="utf-8")
checks = {
    "request timeout is bounded to 30 seconds": 'REQUEST_TIMEOUT_MS=30000' in SOURCE,
    "fetch uses an AbortController signal": 'signal:controller.signal' in SOURCE,
    "timeout abort is scheduled": 'setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS)' in SOURCE,
    "timeout timer is always cleared": 'clearTimeout(requestTimer)' in SOURCE,
    "requests send only committed conversation history": 'history:priorHistory' in SOURCE,
    "user and assistant turns are committed after a successful answer": 'history=[...priorHistory,{role:"user",content:message},{role:"assistant",content:data.answer}]' in SOURCE,
    "failed requests do not append a failed user turn": 'history.push({role:"user",content:message})' not in SOURCE,
    "send button exposes and clears busy state": 'send.setAttribute("aria-busy","true")' in SOURCE and 'send.removeAttribute("aria-busy")' in SOURCE,
    "timeout message is understandable in Arabic": 'استغرق الرد أكثر من 30 ثانية' in SOURCE,
}
failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(("PASS" if passed else "FAIL") + ": " + name)
if failed:
    print(f"Result: FAILED ({len(failed)} issue(s))")
    sys.exit(1)
print(f"Result: PASSED ({len(checks)} checks)")
