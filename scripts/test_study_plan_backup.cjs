"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SCHEMA,
  VERSION,
  MAX_BACKUP_BYTES,
  createBackup,
  parseBackup
} = require("../assets/qd-study-plan-backup.js");

const progress = {
  alternating: [7, 1, 30, 7].filter((day, index, values) => values.indexOf(day) === index),
  quantSprint: [15, 2, 2].filter((day, index, values) => values.indexOf(day) === index)
};
const timestamp = "2026-11-10T05:00:00.000Z";

test("backup round-trip preserves sorted, bounded progress", () => {
  const backup = createBackup(progress, timestamp);
  assert.equal(backup.schema, SCHEMA);
  assert.equal(backup.version, VERSION);
  assert.deepEqual(parseBackup(JSON.stringify(backup)).progress, {
    alternating: [1, 7, 30],
    quantSprint: [2, 15]
  });
});

test("createBackup rejects invalid day values instead of silently dropping them", () => {
  assert.throws(() => createBackup({ alternating: [0], quantSprint: [] }, timestamp), /outside the allowed range/);
});

test("parseBackup rejects malformed JSON", () => {
  assert.throws(() => parseBackup("{broken"), /not valid JSON/);
});

test("parseBackup rejects an unrelated schema", () => {
  const backup = createBackup(progress, timestamp);
  backup.schema = "other-app";
  assert.throws(() => parseBackup(JSON.stringify(backup)), /not an Athar study-plan backup/);
});

test("parseBackup rejects unsupported versions", () => {
  const backup = createBackup(progress, timestamp);
  backup.version = VERSION + 1;
  assert.throws(() => parseBackup(JSON.stringify(backup)), /version is not supported/);
});

test("parseBackup rejects non-canonical timestamps", () => {
  const backup = createBackup(progress, timestamp);
  backup.exportedAt = "2026-11-10";
  assert.throws(() => parseBackup(JSON.stringify(backup)), /timestamp is invalid/);
});

test("parseBackup rejects days outside the plan ranges", () => {
  const backup = createBackup(progress, timestamp);
  backup.progress.alternating.push(31);
  assert.throws(() => parseBackup(JSON.stringify(backup)), /outside the allowed range/);
});

test("parseBackup rejects duplicate days", () => {
  const backup = createBackup(progress, timestamp);
  backup.progress.quantSprint.push(2);
  assert.throws(() => parseBackup(JSON.stringify(backup)), /duplicate day/);
});

test("parseBackup rejects unexpected top-level or progress fields", () => {
  const backup = createBackup(progress, timestamp);
  backup.personalData = "unexpected";
  assert.throws(() => parseBackup(JSON.stringify(backup)), /structure is invalid/);
  const second = createBackup(progress, timestamp);
  second.progress.extra = [];
  assert.throws(() => parseBackup(JSON.stringify(second)), /progress structure is invalid/);
});

test("parseBackup rejects empty and oversized files", () => {
  assert.throws(() => parseBackup(""), /empty or exceeds/);
  assert.throws(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /empty or exceeds/);
});

test("backup schema contains only study progress, not tasks or account data", () => {
  const backup = createBackup(progress, timestamp);
  assert.deepEqual(Object.keys(backup).sort(), ["exportedAt", "progress", "schema", "version"]);
  assert.deepEqual(Object.keys(backup.progress).sort(), ["alternating", "quantSprint"]);
});
