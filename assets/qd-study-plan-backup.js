(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AtharStudyPlanBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = "athar-study-plan-progress";
  const VERSION = 1;
  const MAX_BACKUP_BYTES = 16 * 1024;

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function hasExactKeys(value, expected) {
    return isRecord(value)
      && Object.keys(value).length === expected.length
      && expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  function validateDays(value, max, label) {
    if (!Array.isArray(value) || value.length > max) {
      throw new TypeError(label + " must be an array with at most " + max + " days.");
    }

    const seen = new Set();
    for (const day of value) {
      if (!Number.isInteger(day) || day < 1 || day > max) {
        throw new TypeError(label + " contains a day outside the allowed range.");
      }
      if (seen.has(day)) {
        throw new TypeError(label + " contains a duplicate day.");
      }
      seen.add(day);
    }
    return [...seen].sort((a, b) => a - b);
  }

  function validateProgress(value) {
    if (!hasExactKeys(value, ["alternating", "quantSprint"])) {
      throw new TypeError("The backup progress structure is invalid.");
    }
    return {
      alternating: validateDays(value.alternating, 30, "The 30-day plan"),
      quantSprint: validateDays(value.quantSprint, 15, "The intensive plan")
    };
  }

  function isCanonicalTimestamp(value) {
    if (typeof value !== "string") return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  }

  function createBackup(progress, exportedAt) {
    const timestamp = exportedAt === undefined ? new Date().toISOString() : exportedAt;
    if (!isCanonicalTimestamp(timestamp)) {
      throw new TypeError("The export timestamp must be a canonical ISO timestamp.");
    }
    return {
      schema: SCHEMA,
      version: VERSION,
      exportedAt: timestamp,
      progress: validateProgress(progress)
    };
  }

  function parseBackup(text) {
    if (typeof text !== "string") {
      throw new TypeError("The backup file must contain text.");
    }
    const byteLength = new TextEncoder().encode(text).byteLength;
    if (byteLength === 0 || byteLength > MAX_BACKUP_BYTES) {
      throw new RangeError("The backup file is empty or exceeds the 16 KiB limit.");
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      throw new SyntaxError("The backup file is not valid JSON.");
    }

    if (!hasExactKeys(payload, ["schema", "version", "exportedAt", "progress"])) {
      throw new TypeError("The backup file structure is invalid.");
    }
    if (payload.schema !== SCHEMA) {
      throw new TypeError("This file is not an Athar study-plan backup.");
    }
    if (payload.version !== VERSION) {
      throw new TypeError("This backup version is not supported.");
    }
    if (!isCanonicalTimestamp(payload.exportedAt)) {
      throw new TypeError("The backup timestamp is invalid.");
    }

    return {
      schema: SCHEMA,
      version: VERSION,
      exportedAt: payload.exportedAt,
      progress: validateProgress(payload.progress)
    };
  }

  return Object.freeze({
    SCHEMA,
    VERSION,
    MAX_BACKUP_BYTES,
    createBackup,
    parseBackup,
    validateProgress
  });
});
