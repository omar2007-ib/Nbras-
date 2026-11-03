"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { remainingSeconds } = require("../assets/exam-timer.js");

const examHtml = fs.readFileSync(path.join(__dirname, "..", "exam.html"), "utf8");

test("keeps a full minute when exactly 60 seconds remain", () => {
  assert.equal(remainingSeconds(61_000, 1_000), 60);
});

test("rounds a partial second up instead of ending early", () => {
  assert.equal(remainingSeconds(2_001, 1_002), 1);
});

test("clamps an expired deadline to zero", () => {
  assert.equal(remainingSeconds(10_000, 10_001), 0);
});

test("catches up after a background-tab suspension", () => {
  const deadlineAt = 160_000;
  assert.equal(remainingSeconds(deadlineAt, 131_000), 29);
  assert.equal(remainingSeconds(deadlineAt, 161_000), 0);
});

test("fails closed for invalid timestamps", () => {
  assert.equal(remainingSeconds(Number.NaN, 1_000), 0);
  assert.equal(remainingSeconds(10_000, Number.POSITIVE_INFINITY), 0);
});

test("exam page loads the timer helper before its controller", () => {
  const helperIndex = examHtml.indexOf('<script src="assets/exam-timer.js"></script>');
  const controllerIndex = examHtml.indexOf("<script>\n(function(){");
  assert.ok(helperIndex >= 0);
  assert.ok(controllerIndex > helperIndex);
});

test("exam clock is deadline-based and refreshes after visibility changes", () => {
  assert.match(examHtml, /remaining=window\.AtharExamTimer\.remainingSeconds\(deadlineAt,Date\.now\(\)\)/);
  assert.match(examHtml, /clock=setInterval\(updateTimerFromDeadline,1000\)/);
  assert.match(examHtml, /document\.addEventListener\('visibilitychange'/);
  assert.match(examHtml, /window\.addEventListener\('pageshow',updateTimerFromDeadline\)/);
  assert.doesNotMatch(examHtml, /remaining--/);
});

test("manual submission and cancellation check an elapsed deadline first", () => {
  assert.match(examHtml, /form\.addEventListener\('submit',e=>\{e\.preventDefault\(\);updateTimerFromDeadline\(\)/);
  assert.match(examHtml, /\$\('cancel'\)\.addEventListener\('click',\(\)=>\{updateTimerFromDeadline\(\)/);
});
