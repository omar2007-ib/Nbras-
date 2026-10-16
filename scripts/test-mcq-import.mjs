import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  MAX_IMPORT_BYTES,
  MAX_QUESTIONS,
  validQuestion,
  parseImportText,
  filterNewQuestions,
} = require("../assets/mcq-import.js");

const valid = {
  id: "question-1",
  question: "كم يساوي ٢ + ٢؟",
  options: ["٣", "٤", "٥", "٦"],
  correct: 1,
  category: "كمي",
  difficulty: "سهل",
  explanation: "نجمع العددين.",
  createdAt: "2026-10-16T00:00:00.000Z",
};

assert.equal(validQuestion(valid), true, "accepts a valid Arabic MCQ");
assert.deepEqual(parseImportText(JSON.stringify([valid])), [valid]);

const invalidCases = [
  [{ ...valid, question: "   " }, "empty question"],
  [{ ...valid, question: "س".repeat(1501) }, "overlong question"],
  [{ ...valid, options: ["١", "٢", "", "٤"] }, "empty option"],
  [{ ...valid, options: ["١".repeat(501), "٢", "٣", "٤"] }, "overlong option"],
  [{ ...valid, options: ["١", "٢", "٣"] }, "wrong option count"],
  [{ ...valid, correct: 4 }, "out-of-range answer"],
  [{ ...valid, category: "غير معروف" }, "unknown category"],
  [{ ...valid, difficulty: "متقدم جدًا" }, "unknown difficulty"],
  [{ ...valid, unexpected: "field" }, "unexpected field"],
  [{ ...valid, explanation: "ش".repeat(1501) }, "overlong explanation"],
  [{ ...valid, id: "x".repeat(101) }, "overlong id"],
];

for (const [candidate, label] of invalidCases) {
  assert.equal(validQuestion(candidate), false, `rejects ${label}`);
  assert.throws(() => parseImportText(JSON.stringify([candidate])), undefined, label);
}

assert.throws(() => parseImportText("not JSON"), SyntaxError);
assert.throws(() => parseImportText(JSON.stringify({ question: valid })), TypeError);
assert.throws(() => parseImportText(" ".repeat(MAX_IMPORT_BYTES + 1)), RangeError);
assert.throws(
  () => parseImportText(JSON.stringify(Array.from({ length: MAX_QUESTIONS + 1 }, () => null))),
  RangeError,
  "rejects an oversized question array before validating individual items"
);

const incoming = filterNewQuestions(
  [
    valid,
    { ...valid, id: "question-1" },
    { ...valid, id: "already-saved" },
    { ...valid, id: "question-2" },
  ],
  [{ ...valid, id: "already-saved" }]
);
assert.deepEqual(
  incoming.map((question) => question.id),
  ["question-1", "question-2"],
  "removes IDs already stored and duplicate IDs within the import"
);

assert.ok(MAX_IMPORT_BYTES > 0);
assert.ok(MAX_QUESTIONS > 0);
console.log("PASS: MCQ imports enforce size, count, schema, allowlists, field lengths, and ID deduplication.");
