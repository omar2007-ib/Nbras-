(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AtharSubtitleParser = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";

  const MAX_CUES = 10000;

  function parseTimestamp(raw) {
    const value = String(raw || "").trim().replace(",", ".");
    const parts = value.split(":");
    if (parts.length < 2 || parts.length > 3) {
      throw new Error("توقيت الترجمة غير صالح: " + value);
    }

    const secondsPart = parts.pop();
    const secondsMatch = secondsPart.match(/^(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!secondsMatch) throw new Error("توقيت الترجمة غير صالح: " + value);

    const minutesRaw = parts.pop();
    if (!/^\d{1,2}$/.test(minutesRaw)) throw new Error("توقيت الترجمة غير صالح: " + value);
    const minutes = Number(minutesRaw);
    const hoursRaw = parts.length ? parts.pop() : "0";
    if (!/^\d+$/.test(hoursRaw) || parts.length) throw new Error("توقيت الترجمة غير صالح: " + value);

    const hours = Number(hoursRaw);
    const seconds = Number(secondsMatch[1]);
    const milliseconds = Number((secondsMatch[2] || "").padEnd(3, "0") || 0);
    if (minutes > 59 || seconds > 59 || !Number.isSafeInteger(hours) || hours < 0) {
      throw new Error("توقيت الترجمة خارج النطاق: " + value);
    }
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  function decodeEntities(value) {
    return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, function (entity, token) {
      const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      const key = token.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(named, key)) return named[key];
      const number = key.startsWith("#x")
        ? Number.parseInt(key.slice(2), 16)
        : Number.parseInt(key.slice(1), 10);
      if (!Number.isInteger(number) || number < 0 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) {
        return entity;
      }
      return String.fromCodePoint(number);
    });
  }

  function cleanCueText(value) {
    return decodeEntities(String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\u200b/g, "")
      .replace(/\r/g, ""))
      .split("\n")
      .map(function (line) { return line.replace(/[ \t]+$/g, ""); })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function parse(content, format) {
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("ملف الترجمة فارغ.");
    }
    const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const kind = String(format || "").toLowerCase().replace(/^\./, "");
    const isVtt = kind === "vtt" || /^WEBVTT(?:[ \t]|$)/i.test(normalized);
    if (kind !== "srt" && kind !== "vtt" && !isVtt) {
      throw new Error("صيغة الترجمة غير مدعومة. استخدم SRT أو VTT.");
    }

    const blocks = normalized.split(/\n[ \t]*\n+/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split("\n");
      const first = (lines[0] || "").trim();
      if (!first || /^WEBVTT(?:[ \t]|$)/i.test(first) || /^(NOTE|STYLE|REGION)(?:[ \t]|$)/i.test(first)) {
        continue;
      }
      const timeIndex = lines.findIndex(function (line) { return line.includes("-->"); });
      if (timeIndex < 0) continue;

      const timeParts = lines[timeIndex].split("-->");
      if (timeParts.length !== 2) throw new Error("سطر توقيت الترجمة غير صالح.");
      const start = parseTimestamp(timeParts[0].trim());
      const endToken = timeParts[1].trim().split(/\s+/)[0];
      const end = parseTimestamp(endToken);
      if (end <= start) throw new Error("نهاية الترجمة يجب أن تأتي بعد بدايتها.");

      const text = cleanCueText(lines.slice(timeIndex + 1).join("\n"));
      if (!text) continue;
      cues.push({ start: start, end: end, text: text });
      if (cues.length > MAX_CUES) {
        throw new Error("ملف الترجمة يحتوي على عدد كبير جدًا من المقاطع.");
      }
    }

    if (!cues.length) throw new Error("لم يتم العثور على ترجمات صالحة في الملف.");
    return cues.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
  }

  function clipToRange(cues, clipStart, clipEnd) {
    if (!Array.isArray(cues) || !Number.isFinite(clipStart) || !Number.isFinite(clipEnd) || clipStart < 0 || clipEnd <= clipStart) {
      throw new Error("نطاق قص الترجمة غير صالح.");
    }
    return cues
      .filter(function (cue) {
        return cue && Number.isFinite(cue.start) && Number.isFinite(cue.end) &&
          cue.end > cue.start && cue.end > clipStart && cue.start < clipEnd &&
          typeof cue.text === "string" && cue.text.trim();
      })
      .map(function (cue) {
        return {
          start: Math.max(0, cue.start - clipStart),
          end: Math.min(clipEnd, cue.end) - clipStart,
          text: cue.text.trim()
        };
      })
      .filter(function (cue) { return cue.end > cue.start; })
      .sort(function (a, b) { return a.start - b.start || a.end - b.end; });
  }

  return { parse: parse, parseTimestamp: parseTimestamp, clipToRange: clipToRange };
});
