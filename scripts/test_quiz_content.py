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
    require("const seenIds=new Set(),seenContent=new Set(questions.map(signature)),incoming=[];" in mcq,
            "JSON import must deduplicate repeated IDs and question content within the import and against the existing bank.")
    require("const cached=save();bankStatus.textContent='تم استيراد '" in mcq,
            "Import success must depend on database insert; local-cache failure must be disclosed separately.")
    require("تعذّر تحديث النسخة المحلية، لكن الأسئلة محفوظة في قاعدة البيانات." in mcq,
            "Import must clearly report when database save succeeds but local cache fails.")
    require("ctx.client.from('mcq_questions').insert({question:q.question" in mcq,
            "New questions must be inserted into the authenticated Supabase bank.")
    require("تعذّر حفظ السؤال في قاعدة البيانات:" in mcq,
            "Question creation must show database errors without claiming success.")
    for category in ("كمي", "لفظي", "عام"):
        require(mcq.count(f"<option>{category}</option>") >= 2,
                f"MCQ builder must support the {category} category in creation and AI generation.")
    require("كل التصنيفات" in mcq, "MCQ bank filter must include all categories.")
    require("ctx.client.from('mcq_questions').delete().eq('id',q.id)" in mcq,
            "Deleting a question must remove it from the cloud bank, not only the local cache.")
    require("تم الحذف من قاعدة البيانات، لكن تعذّر تحديث النسخة المحلية." in mcq,
            "Question deletion must distinguish cloud success from local-cache failure.")
    require(mcq.count("document.getElementById('export-json').addEventListener('click'") == 1,
            "JSON export must not have duplicate click handlers.")

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
        "server-backed MCQ exam start": "start_mcq_exam",
        "server-side answer submission and grading": "submit_mcq_exam",
        "timer countdown": "setInterval",
        "automatic submit on timeout": "finish(true)",
        "manual submit confirmation": "هل تريد تسليم الاختبار الآن؟",
        "server result percentage": "data.percent",
        "no answer key requested before submission": "correct_index" not in exam.split("async function begin()", 1)[1].split("async function finish", 1)[0],
        "no local MCQ answer bank used by exam": "athar-mcq-questions-v1" not in exam,
        "local attempt-history key": "athar-exam-history-v1",
        "bounded local attempt history": "MAX_HISTORY=10",
        "attempt history saved after submission": "saveAttempt({date:new Date().toISOString()",
        "answer review visible in results": "مراجعة الإجابات",
        "elapsed-time summary": "الوقت المستغرق:",
        "safe Supabase client setup": "window.supabase.createClient(config.url,config.publishableKey)",
        "retryable submission error state": "إعادة محاولة التسليم",
    }.items():
        require((token in exam) if isinstance(token, str) else token, f"Timed exam missing {label}.")
    require('href="exam.html"' in mcq, "MCQ builder must link to timed exam mode.")

migration_path = ROOT / "supabase/migrations/20261021160000_secure_mcq_exam_flow.sql"
require(migration_path.exists(), "Secure MCQ exam migration is missing.")
if migration_path.exists():
    migration = migration_path.read_text(encoding="utf-8")
    start_fn = migration.split("create or replace function public.start_mcq_exam", 1)[-1].split("create or replace function public.submit_mcq_exam", 1)[0]
    require("revoke all privileges on table public.mcq_questions from anon" in migration,
            "Anonymous users must not have direct read access to the answer-key table.")
    require("revoke all on table public.mcq_exam_attempts from public, anon, authenticated" in migration,
            "Exam attempt records must not be directly readable by clients.")
    require("correct_index" not in start_fn and "explanation" not in start_fn,
            "Starting an exam must not return answer keys or explanations before submission.")
    require("grant execute on function public.start_mcq_exam(text,integer) to anon,authenticated" in migration,
            "Public exam-start RPC must be executable by student clients.")
    require("grant execute on function public.submit_mcq_exam(uuid,jsonb) to anon,authenticated" in migration,
            "Exam submission RPC must be executable by student clients.")

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
