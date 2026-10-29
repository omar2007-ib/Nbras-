"use strict";

const assert = require("node:assert/strict");
const { parse, parseTimestamp, clipToRange } = require("../assets/athar-subtitle-parser.js");

const srt = "\uFEFF1\r\n00:00:01,000 --> 00:00:03,500\r\n<b>أهلًا &amp; مرحبًا</b>\r\n\r\n2\r\n00:00:03,500 --> 00:00:05,000\r\nالسطر الثاني\r\n";
const srtCues = parse(srt, "srt");
assert.equal(srtCues.length, 2, "SRT cues should be parsed");
assert.equal(srtCues[0].start, 1, "SRT start timestamp should be parsed");
assert.equal(srtCues[0].end, 3.5, "SRT end timestamp should be parsed");
assert.equal(srtCues[0].text, "أهلًا & مرحبًا", "markup should be removed and entities decoded");

const vtt = "WEBVTT\r\n\r\nNOTE generated metadata\r\nthis block is not a cue\r\n\r\ncue-1\r\n00:01.000 --> 00:03.000 align:start\r\n<b>Hello &amp; world</b>\r\n\r\n00:03.000 --> 00:05.000\r\nSecond line\r\n";
const vttCues = parse(vtt, "vtt");
assert.equal(vttCues.length, 2, "VTT should skip metadata and parse cue identifiers");
assert.equal(vttCues[0].text, "Hello & world", "VTT formatting tags and entities should be normalized");
assert.equal(parseTimestamp("00:00:01,250"), 1.25, "SRT milliseconds should be supported");
assert.equal(parseTimestamp("01:02.5"), 62.5, "short VTT timestamps should be supported");

const clipped = clipToRange(srtCues, 2, 4);
assert.deepEqual(clipped, [
  { start: 0, end: 1.5, text: "أهلًا & مرحبًا" },
  { start: 1.5, end: 2, text: "السطر الثاني" }
], "subtitle timings should be clipped and shifted to the selected video range");
assert.equal(clipToRange(srtCues, 8, 10).length, 0, "out-of-range cues should be excluded");
assert.throws(() => parse("not a subtitle file", "srt"), /لم يتم العثور/);
assert.throws(() => parseTimestamp("99:99:99.999"), /خارج النطاق/);
assert.throws(() => clipToRange(srtCues, 4, 2), /غير صالح/);

console.log("Subtitle parser tests: 13 assertions passed.");
