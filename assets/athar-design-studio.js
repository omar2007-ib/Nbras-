(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("design-form");
  const titleInput = $("design-title");
  const bodyInput = $("design-body");
  const labelInput = $("design-label");
  const ctaInput = $("design-cta");
  const sizeInput = $("design-size");
  const templateInput = $("design-template");
  const languageInput = $("design-language");
  const preview = $("design-preview");
  const status = $("design-status");
  const svgButton = $("download-svg");
  const pngButton = $("download-png");
  const tokenButton = $("download-tokens");
  const colors = {
    primary: "#5B21B6",
    accent: "#C4B5FD",
    paper: "#FCFAFF",
    soft: "#F3EEFF",
    ink: "#2D2340"
  };
  const sizes = {
    square: { width: 1080, height: 1080, titleChars: 22, bodyChars: 38 },
    portrait: { width: 1080, height: 1350, titleChars: 20, bodyChars: 36 },
    story: { width: 1080, height: 1920, titleChars: 18, bodyChars: 32 }
  };
  let currentSvg = "";
  let previewUrl = "";

  function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;"
    })[character]);
  }

  function wrapLines(value, maxChars) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      if (word.length > maxChars) {
        throw new Error("توجد كلمة طويلة جدًا بالنسبة إلى المقاس المختار. قصّرها أو أضف فواصل مناسبة قبل إنشاء التصميم.");
      }
      const candidate = line ? line + " " + word : word;
      if (line && candidate.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function textBlock(lines, x, y, fontSize, lineHeight, color, anchor, direction, fontWeight) {
    if (!lines.length) return "";
    const tspans = lines.map((line, index) => '<tspan x="' + x + '" dy="' + (index === 0 ? 0 : lineHeight) + '">' + escapeXml(line) + "</tspan>").join("");
    return '<text x="' + x + '" y="' + y + '" fill="' + color + '" font-size="' + fontSize + '" font-weight="' + fontWeight + '" text-anchor="' + anchor + '" direction="' + direction + '" unicode-bidi="plaintext" font-family="Jazeel, sans-serif">' + tspans + "</text>";
  }

  function buildSvg() {
    const title = titleInput.value.trim();
    if (!title) throw new Error("اكتب عنوانًا قبل إنشاء التصميم.");
    const body = bodyInput.value.trim();
    const label = labelInput.value.trim();
    const cta = ctaInput.value.trim();
    const size = sizes[sizeInput.value] || sizes.square;
    const template = templateInput.value;
    const direction = languageInput.value === "en" ? "ltr" : "rtl";
    const anchor = direction === "rtl" ? "end" : "start";
    const x = direction === "rtl" ? size.width - 88 : 88;
    const titleLines = wrapLines(title, size.titleChars);
    const bodyLines = wrapLines(body, size.bodyChars);
    if (titleLines.length > 4) {
      throw new Error("العنوان أطول من المساحة المتاحة في هذا القالب. اختصره أو اختر مقاسًا آخر؛ لم يُحذف أي جزء من النص.");
    }
    if (bodyLines.length > 5) {
      throw new Error("النص المساند أطول من المساحة المتاحة في هذا القالب. اختصره أو قسّمه؛ لم يُحذف أي جزء من النص.");
    }
    const titleSize = size.height >= 1800 ? 82 : 76;
    const titleLineHeight = Math.round(titleSize * 1.28);
    const bodySize = size.height >= 1800 ? 37 : 34;
    const bodyLineHeight = Math.round(bodySize * 1.55);
    const titleY = template === "editorial" ? Math.round(size.height * 0.16) : Math.round(size.height * 0.36);
    const bodyY = titleY + titleLines.length * titleLineHeight + 42;
    const ctaY = size.height - 175;
    let background = '<rect width="' + size.width + '" height="' + size.height + '" fill="' + colors.paper + '"/>';
    let shapes = "";
    let titleColor = colors.primary;
    let bodyColor = colors.ink;

    if (template === "statement") {
      background = '<rect width="' + size.width + '" height="' + size.height + '" fill="' + colors.primary + '"/>';
      shapes = '<rect x="88" y="90" width="150" height="12" rx="6" fill="' + colors.accent + '"/><circle cx="' + (direction === "rtl" ? 120 : size.width - 120) + '" cy="' + (size.height - 120) + '" r="210" fill="' + colors.accent + '" opacity=".18"/>';
      titleColor = "#FFFFFF";
      bodyColor = "#FFFFFF";
    } else if (template === "editorial") {
      shapes = '<rect width="' + size.width + '" height="' + Math.round(size.height * 0.32) + '" fill="' + colors.primary + '"/><rect x="' + (direction === "rtl" ? size.width - 88 : 88) + '" y="' + Math.round(size.height * 0.32) + '" width="190" height="12" rx="6" fill="' + colors.accent + '"/>';
      titleColor = "#FFFFFF";
    } else {
      shapes = '<circle cx="' + (direction === "rtl" ? 90 : size.width - 90) + '" cy="' + Math.round(size.height * 0.2) + '" r="120" fill="' + colors.accent + '" opacity=".72"/><rect x="' + (direction === "rtl" ? size.width - 278 : 88) + '" y="' + Math.round(size.height * 0.2 + 145) + '" width="190" height="10" rx="5" fill="' + colors.primary + '"/>';
    }

    const labelSvg = label
      ? '<text x="' + x + '" y="' + Math.round(size.height * 0.11) + '" fill="' + (template === "statement" ? colors.accent : colors.primary) + '" font-size="30" font-weight="700" text-anchor="' + anchor + '" direction="' + direction + '" unicode-bidi="plaintext" font-family="Jazeel, sans-serif">' + escapeXml(label) + "</text>"
      : "";
    const titleSvg = textBlock(titleLines, x, titleY, titleSize, titleLineHeight, titleColor, anchor, direction, 700);
    const bodySvg = textBlock(bodyLines, x, bodyY, bodySize, bodyLineHeight, bodyColor, anchor, direction, 400);
    let ctaSvg = "";
    if (cta) {
      const ctaWidth = Math.min(size.width - 176, Math.max(210, cta.length * 24 + 70));
      const ctaX = direction === "rtl" ? size.width - 88 - ctaWidth : 88;
      const ctaTextX = direction === "rtl" ? size.width - 88 - ctaWidth / 2 : 88 + ctaWidth / 2;
      const ctaFill = template === "statement" ? colors.accent : colors.primary;
      const ctaText = template === "statement" ? colors.primary : "#FFFFFF";
      ctaSvg = '<rect x="' + ctaX + '" y="' + (ctaY - 48) + '" width="' + ctaWidth + '" height="72" rx="20" fill="' + ctaFill + '"/><text x="' + ctaTextX + '" y="' + ctaY + '" fill="' + ctaText + '" font-size="30" font-weight="700" text-anchor="middle" direction="' + direction + '" unicode-bidi="plaintext" font-family="Jazeel, sans-serif">' + escapeXml(cta) + "</text>";
    }
    const wordmark = '<text x="' + x + '" y="' + (size.height - 62) + '" fill="' + (template === "statement" ? colors.accent : colors.primary) + '" font-size="44" font-weight="700" text-anchor="' + anchor + '" direction="rtl" unicode-bidi="plaintext" font-family="Jazeel, sans-serif">أثَر</text>';
    const svgTitle = escapeXml(title);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size.width + '" height="' + size.height + '" viewBox="0 0 ' + size.width + " " + size.height + '" role="img" aria-labelledby="art-title"><title id="art-title">' + svgTitle + '</title>' + background + shapes + labelSvg + titleSvg + bodySvg + ctaSvg + wordmark + "</svg>";
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.dataset.state = isError ? "error" : "info";
  }

  function renderDesign() {
    try {
      currentSvg = buildSvg();
      const blob = new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      preview.replaceChildren();
      const image = document.createElement("img");
      image.src = previewUrl;
      image.alt = "معاينة تصميم أثَر: " + titleInput.value.trim();
      preview.append(image);
      svgButton.disabled = false;
      pngButton.disabled = false;
      setStatus("تم إنشاء تصميم متجهي فعلي داخل المتصفح. راجع المعاينة قبل التنزيل.", false);
    } catch (error) {
      currentSvg = "";
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = "";
      preview.replaceChildren();
      svgButton.disabled = true;
      pngButton.disabled = true;
      setStatus(error.message || "تعذّر إنشاء التصميم.", true);
    }
  }

  function safeName() {
    return (titleInput.value.trim() || "athar-design").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "athar-design";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderDesign();
  });

  svgButton.addEventListener("click", () => {
    if (!currentSvg) return;
    downloadBlob(new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" }), safeName() + ".svg");
  });

  pngButton.addEventListener("click", async () => {
    if (!currentSvg) return;
    pngButton.disabled = true;
    setStatus("يجري تحويل التصميم إلى PNG داخل المتصفح.", false);
    let imageUrl = "";
    try {
      await document.fonts.ready;
      imageUrl = URL.createObjectURL(new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("تعذّر تحويل SVG إلى صورة على هذا الجهاز."));
      });
      image.src = imageUrl;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas غير متاح لتصدير PNG.");
      context.drawImage(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("لم يتمكن المتصفح من إنشاء ملف PNG.");
      downloadBlob(blob, safeName() + ".png");
      setStatus("تم تصدير PNG بنجاح. افحص الخطوط والتفاف النص على جهازك قبل النشر.", false);
    } catch (error) {
      setStatus(error.message || "تعذّر تصدير PNG.", true);
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      pngButton.disabled = !currentSvg;
    }
  });

  tokenButton.addEventListener("click", () => {
    const tokens = {
      brand: "أثَر",
      palette: colors,
      typography: { wordmark: "Jazeel", licensedFontAssetBundled: false, note: "أضف ملف جزيل المرخّص قبل اعتماد الملفات النهائية." },
      exportSizes: [
        { name: "square", width: 1080, height: 1080 },
        { name: "portrait", width: 1080, height: 1350 },
        { name: "story", width: 1080, height: 1920 }
      ],
      templates: ["minimal", "statement", "editorial"],
      generatedAt: new Date().toISOString()
    };
    downloadBlob(new Blob([JSON.stringify(tokens, null, 2)], { type: "application/json;charset=utf-8" }), "athar-brand-tokens.json");
  });

  window.addEventListener("beforeunload", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
})();