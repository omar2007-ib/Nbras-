(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AtharExamTimer = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function remainingSeconds(deadlineAt, now = Date.now()) {
    if (!Number.isFinite(deadlineAt) || !Number.isFinite(now)) return 0;
    return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  }

  return Object.freeze({ remainingSeconds });
});
