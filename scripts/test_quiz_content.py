#!/usr/bin/env python3
"""Dependency-free regression checks for Athar's quiz-building and practice pages."""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require(ok, message):
    if not ok:
        errors.append(message)

mcq_path = ROOT / "mcq-builder.html"
practice_path = ROOT / "practice.html"
exam_path = ROOT / "exam.html"
require(mcq_path.exists(), "mcq-builder.html is missing.")
require(practice_path.exists(), "practice.html is missing.")
require(exam_path.exists(), "exam.html is missing.")

if mcq_path.exists():
    mcq = mcq_path.read_text(encoding="utf-8")
    require("const optionLabels=['أ','ب','ج','د'];" in mcq,
            "MCQ choices must display Arabic labels أ، ب، ج، د in order.")
    require("String.fromCharCode(0x623+i)" not in mcq,
            "Legacy incorrect Arabic option-label generation remains.")
    require("seen.add(q.id);incoming.push(q)" in mcq,
            "JSON import must deduplicate repeated IDs within the imported file.")
    require("if(save()){render();bankStatus.textContent='تم استيراد '" in mcq,
            "Import must report success only after local storage saves successfully.")
    require("else{questions=previous;}" in mcq,
            "Import must roll back in-memory state if local storage fails.")
    require("تعذّر حفظ السؤال. لم يُضف إلى البنك." in mcq,
            "Question creation must roll back when local storage fails.")
    require("تعذّر الحذف لأن المتصفح لم يحفظ التغيير." in mcq,
            "Question deletion must roll back when local storage fails.")
    require("تعذّر المسح لأن المتصفح لم يحفظ التغيير." in mcq,
            "Clearing the bank must roll back when local storage fails.")

class QuizParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.questions = []
        self.current = None
        self.current_label = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "fieldset" and "question" in attrs.get("class", "").split():
            self.current = {
                "answer": attrs.get("data-answer"),
                "explain": attrs.get("data-explain", ""),
                "options": [],
            }
            self.questions.append(self.current)
        elif self.current is not None and tag == "label":
            self.current_label = {"value": None, "text": ""}
        elif self.current is not None and tag == "input" and self.current_label is not None:
            if attrs.get("type") == "radio":
                self.current_label["value"] = attrs.get("value")

    def handle_data(self, data):
        if self.current_label is not None:
            self.current_label["text"] += data

    def handle_endtag(self, tag):
        if tag == "label" and self.current is not None and self.current_label is not None:
            self.current["options"].append(self.current_label)
            self.current_label = None
        elif tag == "fieldset":
            self.current = None
            self.current_label = None

if exam_path.exists():
    exam = exam_path.read_text(encoding="utf-8")
    for label, token in {
        "timed exam reads the MCQ bank": "athar-mcq-questions-v1",
        "timer countdown": "setInterval",
        "automatic submit on timeout": "finish(true)",
        "manual submit confirmation": "هل تريد تسليم الاختبار الآن؟",
        "result percentage": "Math.round(score/active.length*100)",
        "local-only data disclosure": "ولا تُرسل إلى خادم",
        "unbiased Fisher-Yates question shuffle": "function shuffle(items)",
        "shuffle used when starting an exam": "active=shuffle(pool)",
        "local attempt-history key": "athar-exam-history-v1",
        "bounded local attempt history": "MAX_HISTORY=10",
        "attempt history saved after submission": "saveAttempt({date:new Date().toISOString()",
        "answer review visible in results": "مراجعة الإجابات",
        "elapsed-time summary": "الوقت المستغرق:",
    }.items():
        require(token in exam, f"Timed exam missing {label}.")
    require('href="exam.html"' in mcq, "MCQ builder must link to timed exam mode.")

quiz_count = 0
if practice_path.exists():
    parser = QuizParser()
    parser.feed(practice_path.read_text(encoding="utf-8"))
    quiz_count = len(parser.questions)
    require(len(parser.questions) > 0, "Practice page has no question fieldsets.")
    for index, question in enumerate(parser.questions, start=1):
        opts = question["options"]
        values = [o["value"] for o in opts]
        require(len(opts) == 4, f"Practice question {index} must have exactly four options.")
        require(set(values) == {"0", "1", "2", "3"},
                f"Practice question {index} must provide radio values 0, 1, 2, 3.")
        require(question["answer"] in values,
                f"Practice question {index} answer key does not match an option.")
        require(bool(question["explain"].strip()),
                f"Practice question {index} is missing its explanation.")

if errors:
    for error in errors:
        print("FAIL: " + error)
    print(f"Quiz regression checks: FAILED ({len(errors)} issue(s))")
    sys.exit(1)
print(f"Quiz regression checks: PASSED ({quiz_count} practice questions checked; static invariants verified).")
