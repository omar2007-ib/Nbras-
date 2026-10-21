/* Bounded, testable validation and PDF text extraction for Athar's MCQ generator. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AtharMcqGenerator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_PDF_BYTES = 20 * 1024 * 1024;
  const MAX_PDF_PAGES = 100;
  const MIN_SOURCE_CHARS = 80;
  const MAX_SOURCE_CHARS = 30000;
  const MAX_QUESTIONS = 30;
  const MAX_QUESTION_CHARS = 1500;
  const MAX_OPTION_CHARS = 500;
  const MAX_EXPLANATION_CHARS = 1500;
  const CATEGORIES = new Set(["كمي", "لفظي", "عام"]);
  const DIFFICULTIES = new Set(["سهل", "متوسط", "صعب", "متدرج"]);

  function validateSourceText(value) {
    if (typeof value !== "string") {
      return { ok: false, message: "أدخل نصًا صالحًا من الدرس أو الملف." };
    }
    const text = value.trim();
    if (text.length < MIN_SOURCE_CHARS) {
      return { ok: false, message: "أضف نصًا أطول (80 حرفًا على الأقل) قبل توليد الأسئلة." };
    }
    if (text.length > MAX_SOURCE_CHARS) {
      return { ok: false, message: "النص طويل جدًا؛ الحد الأقصى 30 ألف حرف." };
    }
    return { ok: true, text };
  }

  function isValidGeneratedQuestion(question) {
    if (!question || typeof question !== "object" || Array.isArray(question)) return false;
    if (typeof question.question !== "string") return false;
    const title = question.question.trim();
    if (!title || title.length > MAX_QUESTION_CHARS) return false;
    if (!Array.isArray(question.options) || question.options.length !== 4) return false;
    const options = question.options;
    if (!options.every((option) => typeof option === "string" && option.trim() && option.trim().length <= MAX_OPTION_CHARS)) return false;
    const normalizedOptions = options.map((option) => option.trim().normalize("NFKC").toLocaleLowerCase("ar"));
    if (new Set(normalizedOptions).size !== 4) return false;
    if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct > 3) return false;
    if (!CATEGORIES.has(question.category) || !DIFFICULTIES.has(question.difficulty)) return false;
    if (question.explanation !== undefined && (typeof question.explanation !== "string" || question.explanation.length > MAX_EXPLANATION_CHARS)) return false;
    return true;
  }

  function validateGeneratedResponse(payload, requestedCount) {
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > MAX_QUESTIONS) {
      return { ok: false, message: "عدد الأسئلة يجب أن يكون من 1 إلى 30." };
    }
    if (!payload || !Array.isArray(payload.questions)) {
      return { ok: false, message: "لم تُرجع خدمة التوليد قائمة أسئلة قابلة للقراءة." };
    }
    if (payload.questions.length < 1) {
      return { ok: false, message: "لم ينتج النموذج أسئلة. جرّب مصدرًا أوضح." };
    }
    if (payload.questions.length > requestedCount) {
      return { ok: false, message: "أعادت خدمة التوليد عددًا أكبر من المطلوب؛ لم تُعتمد أي مسودة." };
    }
    if (!payload.questions.every(isValidGeneratedQuestion)) {
      return { ok: false, message: "تحتوي النتيجة على سؤال أو خيارات غير صالحة؛ لم تُعتمد أي مسودة." };
    }
    return {
      ok: true,
      questions: payload.questions.map((question) => ({
        question: question.question.trim(),
        options: question.options.map((option) => option.trim()),
        correct: question.correct,
        category: question.category,
        difficulty: question.difficulty,
        explanation: typeof question.explanation === "string" ? question.explanation.trim() : ""
      }))
    };
  }

  async function extractPdfText(file, pdfjsLib) {
    if (!file || typeof file.slice !== "function" || typeof file.arrayBuffer !== "function") {
      throw new Error("اختر ملف PDF أولًا.");
    }
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".pdf") && file.type !== "application/pdf") {
      throw new Error("اختر ملفًا بصيغة PDF فقط.");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("ملف PDF فارغ أو غير صالح.");
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("حجم ملف PDF يتجاوز 20 ميجابايت.");
    }
    if (!pdfjsLib || typeof pdfjsLib.getDocument !== "function") {
      throw new Error("تعذّر تحميل مكتبة قراءة PDF. تحقق من الاتصال ثم أعد المحاولة.");
    }

    const headerBuffer = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
    const header = new TextDecoder().decode(new Uint8Array(headerBuffer));
    if (!header.includes("%PDF-")) {
      throw new Error("محتوى الملف لا يبدو ملف PDF صالحًا.");
    }

    let loadingTask;
    try {
      loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
      const pdf = await loadingTask.promise;
      if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1) {
        throw new Error("ملف PDF لا يحتوي على صفحات قابلة للقراءة.");
      }
      if (pdf.numPages > MAX_PDF_PAGES) {
        throw new Error("ملف PDF يتجاوز الحد المسموح وهو 100 صفحة.");
      }

      let text = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages && text.length < MAX_SOURCE_CHARS; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        for (const item of content.items || []) {
          if (typeof item.str !== "string" || !item.str) continue;
          const separator = item.hasEOL ? "\n" : " ";
          const remaining = MAX_SOURCE_CHARS - text.length;
          text += (item.str + separator).slice(0, remaining);
          if (text.length >= MAX_SOURCE_CHARS) break;
        }
      }
      return text.replace(/[ \t]+\n/g, "\n").trim().slice(0, MAX_SOURCE_CHARS);
    } finally {
      try {
        if (loadingTask && typeof loadingTask.destroy === "function") await loadingTask.destroy();
      } catch (_) {
        // Cleanup must not mask a useful parse or validation error.
      }
    }
  }

  return {
    MAX_PDF_BYTES,
    MAX_PDF_PAGES,
    MIN_SOURCE_CHARS,
    MAX_SOURCE_CHARS,
    MAX_QUESTIONS,
    MAX_QUESTION_CHARS,
    MAX_OPTION_CHARS,
    MAX_EXPLANATION_CHARS,
    validateSourceText,
    isValidGeneratedQuestion,
    validateGeneratedResponse,
    extractPdfText
  };
});
