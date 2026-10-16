(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.NibrasMcqImport = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_QUESTIONS = 2000;
  const ALLOWED_FIELDS = new Set([
    "id",
    "question",
    "options",
    "correct",
    "category",
    "difficulty",
    "explanation",
    "createdAt",
  ]);
  const ALLOWED_CATEGORIES = new Set(["كمي", "لفظي", "عام"]);
  const ALLOWED_DIFFICULTIES = new Set(["سهل", "متوسط", "صعب"]);

  function validQuestion(question) {
    if (!question || typeof question !== "object" || Array.isArray(question)) return false;
    if (Object.keys(question).some((key) => !ALLOWED_FIELDS.has(key))) return false;

    return (
      typeof question.id === "string" &&
      question.id.trim().length > 0 &&
      question.id.length <= 100 &&
      typeof question.question === "string" &&
      question.question.trim().length > 0 &&
      question.question.length <= 1500 &&
      Array.isArray(question.options) &&
      question.options.length === 4 &&
      question.options.every(
        (option) =>
          typeof option === "string" &&
          option.trim().length > 0 &&
          option.length <= 500
      ) &&
      Number.isInteger(question.correct) &&
      question.correct >= 0 &&
      question.correct < 4 &&
      ALLOWED_CATEGORIES.has(question.category) &&
      ALLOWED_DIFFICULTIES.has(question.difficulty) &&
      (question.explanation === undefined ||
        (typeof question.explanation === "string" && question.explanation.length <= 1500)) &&
      (question.createdAt === undefined ||
        (typeof question.createdAt === "string" && question.createdAt.length <= 40))
    );
  }

  function parseImportText(text) {
    if (typeof text !== "string") {
      throw new TypeError("Import data must be text.");
    }
    if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
      throw new RangeError("Import file exceeds the size limit.");
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new TypeError("Import data must be an array.");
    }
    if (data.length > MAX_QUESTIONS) {
      throw new RangeError("Import contains too many questions.");
    }
    if (!data.every(validQuestion)) {
      throw new TypeError("Import contains an invalid question.");
    }
    return data;
  }

  function filterNewQuestions(incoming, existing) {
    const seen = new Set(
      existing.filter(validQuestion).map((question) => question.id)
    );

    return incoming.filter((question) => {
      if (!validQuestion(question) || seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    });
  }

  return {
    MAX_IMPORT_BYTES,
    MAX_QUESTIONS,
    validQuestion,
    parseImportText,
    filterNewQuestions,
  };
});
