(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const fileInput = $("video-file");
  const sourceVideo = $("source-preview");
  const outputVideo = $("output-preview");
  const status = $("studio-status");
  const meta = $("video-meta");
  const startInput = $("clip-start");
  const durationInput = $("clip-duration");
  const detectButton = $("detect-scenes");
  const sceneProgress = $("scene-progress");
  const sceneResults = $("scene-results");
  const captionStart = $("caption-start");
  const captionEnd = $("caption-end");
  const captionText = $("caption-text");
  const captionLanguage = $("caption-language");
  const captionFileInput = $("caption-file");
  const importCaptionsButton = $("import-captions");
  const addCaptionButton = $("add-caption");
  const captionList = $("caption-list");
  const exportButton = $("export-short");
  const progress = $("export-progress");
  const downloadVideo = $("download-video");
  const downloadSrt = $("download-srt");
  const exportMeta = $("export-meta");

  const MAX_FILE_BYTES = 250 * 1024 * 1024;
  const MAX_IMPORTED_SUBTITLE_BYTES = 5 * 1024 * 1024;
  const MAX_IMPORTED_CAPTIONS = 500;
  const MAX_CLIP_SECONDS = 180;
  const MAX_CAPTION_LINES = 4;
  const SAMPLE_WIDTH = 64;
  const SAMPLE_HEIGHT = 36;
  let selectedFile = null;
  let fileLoadGeneration = 0;
  let sourceUrl = null;
  let outputUrl = null;
  let captions = [];
  let sceneTimes = [];
  let exporting = false;
  let scanFrameId = 0;
  let fallbackAudioContext = null;
  let fallbackAudioSource = null;

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || "info";
  }

  function formatTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const remaining = value - minutes * 60;
    return String(minutes).padStart(2, "0") + ":" + remaining.toFixed(1).padStart(4, "0");
  }

  function clipBounds() {
    const total = Number(sourceVideo.duration);
    const start = Number(startInput.value);
    const duration = Number(durationInput.value);
    if (!Number.isFinite(total) || total <= 0) throw new Error("تعذّر قراءة مدة الفيديو.");
    if (!Number.isFinite(start) || start < 0 || start >= total) throw new Error("بداية المقطع يجب أن تكون داخل مدة الفيديو.");
    if (!Number.isFinite(duration) || duration < 1 || duration > MAX_CLIP_SECONDS) throw new Error("مدة المقطع يجب أن تكون بين ثانية و180 ثانية.");
    if (start + duration > total + 0.05) throw new Error("نهاية المقطع تتجاوز مدة الفيديو.");
    return { start, end: Math.min(total, start + duration), duration: Math.min(duration, total - start) };
  }

  function setBusy(busy) {
    exporting = busy;
    fileInput.disabled = busy;
    detectButton.disabled = busy || !selectedFile;
    addCaptionButton.disabled = busy || !selectedFile;
    exportButton.disabled = busy || !selectedFile;
    startInput.disabled = busy;
    durationInput.disabled = busy;
    captionStart.disabled = busy;
    captionEnd.disabled = busy;
    captionText.disabled = busy;
    captionLanguage.disabled = busy;
    captionFileInput.disabled = busy || !selectedFile;
    importCaptionsButton.disabled = busy || !selectedFile;
  }

  function revokeUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function cleanFileName(name) {
    return String(name || "athar-short").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "athar-short";
  }

  function waitForMediaEvent(media, eventName, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let timeoutId = 0;
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        media.removeEventListener(eventName, onEvent);
        media.removeEventListener("error", onError);
      };
      const onEvent = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("تعذّر قراءة الفيديو في المتصفح."));
      };
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("استغرق المتصفح وقتًا طويلًا في قراءة الفيديو. جرّب ملفًا آخر أو مقطعًا أقصر."));
      }, timeoutMs);
      media.addEventListener(eventName, onEvent, { once: true });
      media.addEventListener("error", onError, { once: true });
    });
  }

  function updateClipLimits() {
    if (!selectedFile || !Number.isFinite(sourceVideo.duration)) return;
    const total = sourceVideo.duration;
    const start = Math.max(0, Math.min(Number(startInput.value) || 0, Math.max(0, total - 1)));
    const duration = Math.max(1, Math.min(Number(durationInput.value) || 30, MAX_CLIP_SECONDS, total - start));
    startInput.max = String(Math.max(0, total - 1));
    durationInput.max = String(Math.min(MAX_CLIP_SECONDS, total - start));
    startInput.value = start.toFixed(1);
    durationInput.value = duration.toFixed(1);
    captionEnd.max = String(duration);
    if (Number(captionEnd.value) > duration) captionEnd.value = duration.toFixed(1);
    renderCaptions();
  }

  function resetOutput() {
    revokeUrl(outputUrl);
    outputUrl = null;
    outputVideo.removeAttribute("src");
    outputVideo.hidden = true;
    downloadVideo.hidden = true;
    downloadVideo.removeAttribute("href");
    downloadSrt.hidden = captions.length === 0;
    exportMeta.textContent = "";
    progress.hidden = true;
    progress.value = 0;
  }

  fileInput.addEventListener("change", async () => {
    const loadGeneration = ++fileLoadGeneration;
    if (exporting) return;
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const supportedExtensions = ["mp4", "webm", "mov", "m4v"];
    if (!(file.type.startsWith("video/") || supportedExtensions.includes(extension))) {
      fileInput.value = "";
      setStatus("اختر ملف فيديو بصيغة MP4 أو WebM أو MOV أو M4V.", "error");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      fileInput.value = "";
      setStatus("حجم الملف أكبر من 250 ميجابايت. اختر ملفًا أصغر لتجنب نفاد ذاكرة المتصفح.", "error");
      return;
    }
    selectedFile = file;
    revokeUrl(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    const metadataReady = waitForMediaEvent(sourceVideo, "loadedmetadata");
    resetOutput();
    sourceVideo.src = sourceUrl;
    sourceVideo.hidden = false;
    captions = [];
    captionFileInput.value = "";
    sceneTimes = [];
    sceneResults.replaceChildren();
    renderCaptions();
    meta.textContent = file.name + " — " + (file.size / (1024 * 1024)).toFixed(1) + " MB — جارٍ قراءة المدة…";
    setStatus("يُقرأ الملف محليًا داخل المتصفح.", "info");
    try {
      await metadataReady;
      // A newer selection may have replaced this source while metadata was loading.
      if (loadGeneration !== fileLoadGeneration) return;
      if (!Number.isFinite(sourceVideo.duration) || sourceVideo.duration <= 0) throw new Error("لم يتمكن المتصفح من قراءة مدة هذا الملف.");
      startInput.value = "0";
      durationInput.value = Math.min(30, sourceVideo.duration).toFixed(1);
      updateClipLimits();
      meta.textContent = file.name + " — " + (file.size / (1024 * 1024)).toFixed(1) + " MB — المدة " + formatTime(sourceVideo.duration);
      detectButton.disabled = false;
      addCaptionButton.disabled = false;
      captionFileInput.disabled = false;
      importCaptionsButton.disabled = false;
      exportButton.disabled = false;
      setStatus("الفيديو جاهز. اختر نقطة البداية وأضف الترجمة قبل التصدير.", "success");
    } catch (error) {
      // Ignore errors from an older selection; they must not disable or overwrite the newer file.
      if (loadGeneration !== fileLoadGeneration) return;
      selectedFile = null;
      detectButton.disabled = true;
      addCaptionButton.disabled = true;
      captionFileInput.disabled = true;
      importCaptionsButton.disabled = true;
      exportButton.disabled = true;
      // Release the failed source immediately instead of keeping its object URL alive until
      // another selection or page unload. Only the latest load may clear the active source.
      revokeUrl(sourceUrl);
      sourceUrl = null;
      sourceVideo.pause();
      sourceVideo.removeAttribute("src");
      sourceVideo.load();
      meta.textContent = "";
      setStatus(error.message || "تعذّر فتح الفيديو.", "error");
    }
  });

  function handleClipBoundsChange() {
    updateClipLimits();
    // A clip-range change invalidates prior output, even if validation rejects the new range.
    resetOutput();
    try {
      clipBounds();
      setStatus("تغيّر نطاق المقطع. أعد التصدير للحصول على ملف مطابق للإعدادات الحالية.", "info");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  startInput.addEventListener("change", handleClipBoundsChange);
  durationInput.addEventListener("change", handleClipBoundsChange);

  function meanFrameDifference(previous, current) {
    let total = 0;
    let samples = 0;
    for (let index = 0; index < current.length; index += 4) {
      total += Math.abs(current[index] - previous[index]);
      total += Math.abs(current[index + 1] - previous[index + 1]);
      total += Math.abs(current[index + 2] - previous[index + 2]);
      samples += 3;
    }
    return samples ? total / samples : 0;
  }

  async function detectSceneChanges() {
    if (!selectedFile || exporting) return;
    detectButton.disabled = true;
    // Prevent replacing the selected file while the scanner is reading its object URL.
    fileInput.disabled = true;
    sceneResults.replaceChildren();
    sceneTimes = [];
    sceneProgress.textContent = "يجري تحليل تغيّر الإطارات محليًا؛ لا تغلق الصفحة أثناء الفحص.";
    setStatus("يجري البحث عن تغيّرات بصرية في الفيديو.", "info");
    const scanner = document.createElement("video");
    scanner.muted = true;
    scanner.playsInline = true;
    scanner.preload = "auto";
    scanner.playbackRate = 4;
    const metadataReady = waitForMediaEvent(scanner, "loadedmetadata");
    scanner.src = sourceUrl;
    let previous = null;
    let lastSampleTime = -1;
    let lastSceneTime = -10;
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = SAMPLE_WIDTH;
    sampleCanvas.height = SAMPLE_HEIGHT;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      detectButton.disabled = false;
      fileInput.disabled = false;
      sceneProgress.textContent = "";
      setStatus("هذا المتصفح لا يدعم تحليل الإطارات في Canvas.", "error");
      return;
    }

    try {
      await metadataReady;
      scanner.currentTime = 0;
      if (scanner.readyState < 2) await waitForMediaEvent(scanner, "loadeddata");
      await scanner.play();
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          cancelAnimationFrame(scanFrameId);
          scanner.removeEventListener("ended", onEnded);
          if (error) reject(error); else resolve();
        };
        const onEnded = () => finish();
        scanner.addEventListener("ended", onEnded, { once: true });
        const tick = () => {
          if (scanner.ended || scanner.currentTime >= scanner.duration - 0.05) {
            finish();
            return;
          }
          if (scanner.readyState >= 2 && scanner.currentTime - lastSampleTime >= 0.45) {
            try {
              context.drawImage(scanner, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
              const current = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
              if (previous) {
                const score = meanFrameDifference(previous, current);
                const time = scanner.currentTime;
                if (score >= 27 && time >= 1.5 && time - lastSceneTime >= 4.5) {
                  sceneTimes.push(Number(time.toFixed(1)));
                  lastSceneTime = time;
                }
              }
              previous = new Uint8ClampedArray(current);
              lastSampleTime = scanner.currentTime;
              sceneProgress.textContent = "تم فحص " + formatTime(scanner.currentTime) + " من " + formatTime(scanner.duration) + " — نقاط التغيّر: " + sceneTimes.length;
            } catch (error) {
              finish(error);
              return;
            }
          }
          scanFrameId = requestAnimationFrame(tick);
        };
        scanFrameId = requestAnimationFrame(tick);
      });
      scanner.pause();
      renderSceneSuggestions();
      if (sceneTimes.length) {
        setStatus("اكتمل الفحص. الاقتراحات مبنية على تغيّر الصورة فقط، وليست تقييمًا لمحتوى الكلام.", "success");
        sceneProgress.textContent = "عُثر على " + sceneTimes.length + " نقطة تغيّر بصري.";
      } else {
        setStatus("اكتمل الفحص ولم تُكتشف نقاط واضحة. يمكنك ضبط البداية والمدة يدويًا.", "info");
        sceneProgress.textContent = "لم يُكتشف تغيّر يتجاوز العتبة المحددة.";
      }
    } catch (error) {
      scanner.pause();
      setStatus(error.message || "تعذّر تحليل المشاهد على هذا الجهاز.", "error");
      sceneProgress.textContent = "جرّب ملفًا أقصر أو اضبط القص يدويًا.";
    } finally {
      scanner.removeAttribute("src");
      scanner.load();
      detectButton.disabled = !selectedFile;
      fileInput.disabled = false;
    }
  }

  function renderSceneSuggestions() {
    sceneResults.replaceChildren();
    sceneTimes.slice(0, 40).forEach((time, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-chip";
      button.textContent = "اقتراح " + (index + 1) + " · " + formatTime(time);
      button.addEventListener("click", () => {
        const total = sourceVideo.duration;
        const wantedDuration = Math.min(30, MAX_CLIP_SECONDS, total);
        let start = Math.max(0, time - Math.min(10, wantedDuration / 3));
        if (start + wantedDuration > total) start = Math.max(0, total - wantedDuration);
        startInput.value = start.toFixed(1);
        durationInput.value = wantedDuration.toFixed(1);
        updateClipLimits();
        // Programmatic range changes do not fire the input change handlers.
        // Invalidate any previous export so it cannot be downloaded for the old range.
        resetOutput();
        try {
          clipBounds();
          setStatus("تم اختيار نقطة تغيّر بصري. راجع المعاينة وحدّد إن كان المقطع مناسبًا، ثم أعد التصدير.", "info");
        } catch (error) {
          setStatus(error.message, "error");
        }
      });
      sceneResults.append(button);
    });
  }

  detectButton.addEventListener("click", detectSceneChanges);

  function renderCaptions() {
    captionList.replaceChildren();
    captions.forEach((caption, index) => {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = formatTime(caption.start) + "–" + formatTime(caption.end) + " · " + caption.text;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "caption-remove";
      remove.textContent = "حذف";
      remove.setAttribute("aria-label", "حذف الترجمة " + (index + 1));
      remove.addEventListener("click", () => {
        captions.splice(index, 1);
        renderCaptions();
        resetOutput();
      });
      item.append(text, remove);
      captionList.append(item);
    });
    downloadSrt.hidden = captions.length === 0;
  }


  importCaptionsButton.addEventListener("click", async () => {
    if (!selectedFile || exporting) return;
    const subtitleFile = captionFileInput.files && captionFileInput.files[0];
    if (!subtitleFile) {
      setStatus("اختر ملف SRT أو VTT أولًا.", "error");
      return;
    }
    if (subtitleFile.size > MAX_IMPORTED_SUBTITLE_BYTES) {
      setStatus("ملف الترجمة أكبر من 5 ميجابايت. اختر ملفًا أصغر.", "error");
      return;
    }
    const extension = subtitleFile.name.toLowerCase().split(".").pop();
    if (extension !== "srt" && extension !== "vtt") {
      setStatus("صيغة الترجمة غير مدعومة. استخدم ملف SRT أو VTT.", "error");
      return;
    }

    setBusy(true);
    setStatus("يجري قراءة ملف الترجمة وربط توقيته بالمقطع المحدد محليًا.", "info");
    try {
      const parser = window.AtharSubtitleParser;
      if (!parser || typeof parser.parse !== "function" || typeof parser.clipToRange !== "function") {
        throw new Error("أداة قراءة ملفات الترجمة غير متاحة. أعد تحميل الصفحة وحاول مرة أخرى.");
      }
      const content = await subtitleFile.text();
      const parsed = parser.parse(content, extension);
      const bounds = clipBounds();
      const mapped = parser.clipToRange(parsed, bounds.start, bounds.end);
      if (!mapped.length) {
        throw new Error("لا يحتوي ملف الترجمة على نصوص تقع داخل المقطع المحدد.");
      }
      if (mapped.length > MAX_IMPORTED_CAPTIONS) {
        throw new Error("يحتوي المقطع على أكثر من 500 ترجمة. قصّر نطاق الفيديو أو قسّم ملف الترجمة.");
      }

      const imported = mapped.map((caption) => ({
        start: caption.start,
        end: caption.end,
        text: caption.text,
        language: captionLanguage.value
      }));
      const ordered = [...imported].sort((a, b) => a.start - b.start);
      const overlap = ordered.find((caption, index) => index > 0 && caption.start < ordered[index - 1].end);
      if (overlap) {
        throw new Error("ملف الترجمة يحتوي على توقيتات متداخلة داخل هذا المقطع. أصلح التوقيتات ثم أعد الاستيراد.");
      }
      const measureCanvas = document.createElement("canvas");
      const measureContext = measureCanvas.getContext("2d");
      if (!measureContext || ordered.some((caption) => !captionLayout(caption.text, measureContext, 620))) {
        throw new Error("هناك ترجمة طويلة لا تتسع في الإطار العمودي. قصّر النص أو قسّمه في ملف الترجمة؛ لم يتم استبدال الترجمات الحالية.");
      }

      captions = ordered;
      renderCaptions();
      resetOutput();
      setStatus("تم استيراد " + captions.length + " ترجمة من " + subtitleFile.name + " وتعديل توقيتها للمقطع المحدد. راجعها قبل التصدير.", "success");
    } catch (error) {
      setStatus(error.message || "تعذّر استيراد ملف الترجمة.", "error");
    } finally {
      setBusy(false);
    }
  });

  addCaptionButton.addEventListener("click", () => {
    if (!selectedFile) return;
    const start = Number(captionStart.value);
    const end = Number(captionEnd.value);
    const text = captionText.value.trim();
    let bounds;
    try { bounds = clipBounds(); } catch (error) { setStatus(error.message, "error"); return; }
    if (!text) { setStatus("اكتب نص الترجمة أولًا.", "error"); return; }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > bounds.duration) {
      setStatus("توقيت الترجمة يجب أن يبدأ بعد الصفر وينتهي بعد بدايته وداخل مدة المقطع.", "error");
      return;
    }
    const overlapsExisting = captions.some((caption) => start < caption.end && end > caption.start);
    if (overlapsExisting) {
      setStatus("توقيت الترجمة يتداخل مع ترجمة أخرى. عدّل البداية أو النهاية حتى لا تتراكب النصوص على الفيديو.", "error");
      return;
    }
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext || !captionLayout(text, measureContext, 620)) {
      setStatus("نص الترجمة أطول من المساحة المتاحة على الفيديو. قسّمه إلى أكثر من ترجمة قصيرة حتى لا يُحذف أي جزء.", "error");
      return;
    }
    captions.push({ start, end, text, language: captionLanguage.value });
    captions.sort((a, b) => a.start - b.start);
    captionText.value = "";
    renderCaptions();
    resetOutput();
    setStatus("أُضيفت الترجمة. ستُدمج في الفيديو عند التصدير ويمكن تنزيل SRT منفصل.", "success");
  });

  function validateCaptions(duration, requireVisualFit = false) {
    const invalid = captions.find((caption) => caption.start < 0 || caption.end <= caption.start || caption.end > duration + 0.01);
    if (invalid) throw new Error("هناك ترجمة تتجاوز مدة المقطع الحالي. عدّل توقيتها أو راجع مدة المقطع قبل التصدير.");
    const ordered = [...captions].sort((a, b) => a.start - b.start);
    const overlap = ordered.find((caption, index) => index > 0 && caption.start < ordered[index - 1].end);
    if (overlap) throw new Error("توقيت الترجمات يتداخل. عدّل أوقات البداية والنهاية قبل التصدير حتى لا تتراكب النصوص.");
    if (requireVisualFit && captions.length) {
      const measureCanvas = document.createElement("canvas");
      const measureContext = measureCanvas.getContext("2d");
      if (!measureContext || captions.some((caption) => !captionLayout(caption.text, measureContext, 620))) {
        throw new Error("إحدى الترجمات أطول من المساحة المتاحة على الفيديو. قصّر النص أو قسّمه إلى ترجمات متتابعة قبل التصدير.");
      }
    }
  }

  function srtTimestamp(seconds) {
    const milliseconds = Math.max(0, Math.round(seconds * 1000));
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const secs = Math.floor((milliseconds % 60000) / 1000);
    const millis = milliseconds % 1000;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0") + "," + String(millis).padStart(3, "0");
  }

  function buildSrt() {
    return captions.map((caption, index) => (index + 1) + "\n" + srtTimestamp(caption.start) + " --> " + srtTimestamp(caption.end) + "\n" + caption.text.replace(/\r?\n/g, "\n") + "\n").join("\n");
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

  downloadSrt.addEventListener("click", () => {
    if (!captions.length) return;
    try {
      const bounds = clipBounds();
      validateCaptions(bounds.duration);
    } catch (error) {
      setStatus(error.message, "error");
      return;
    }
    const languages = Array.from(new Set(captions.map((caption) => caption.language)));
    const language = languages.length === 1 ? languages[0] : "multi";
    const baseName = cleanFileName(selectedFile ? selectedFile.name : "athar-short");
    downloadBlob(new Blob(["\uFEFF", buildSrt()], { type: "text/plain;charset=utf-8" }), baseName + "." + language + ".srt");
  });

  function wrapCanvasText(text, context, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const candidate = current ? current + " " + word : word;
      if (current && context.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function captionLayout(text, context, maxWidth) {
    const fontSizes = [42, 38, 34, 30, 26];
    for (const fontSize of fontSizes) {
      context.font = '700 ' + fontSize + 'px "Jazeel", sans-serif';
      const lines = wrapCanvasText(text, context, maxWidth);
      if (lines.length <= MAX_CAPTION_LINES && lines.every((line) => context.measureText(line).width <= maxWidth)) {
        return { lines, fontSize };
      }
    }
    return null;
  }

  function drawCover(context, video, canvas) {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return;
    const targetRatio = canvas.width / canvas.height;
    const sourceRatio = sourceWidth / sourceHeight;
    let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }
    context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  function drawActiveCaption(context, canvas, relativeTime) {
    const active = captions.find((caption) => relativeTime >= caption.start && relativeTime <= caption.end);
    if (!active) return;
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.direction = active.language === "en" ? "ltr" : "rtl";
    const layout = captionLayout(active.text, context, canvas.width - 100);
    if (!layout) { context.restore(); return; }
    context.font = '700 ' + layout.fontSize + 'px "Jazeel", sans-serif';
    const lines = layout.lines;
    const lineHeight = Math.round(layout.fontSize * 1.25);
    const boxHeight = lines.length * lineHeight + 30;
    const boxY = Math.max(40, canvas.height - 110 - boxHeight);
    context.fillStyle = "rgba(27, 16, 45, 0.82)";
    context.fillRect(28, boxY, canvas.width - 56, boxHeight);
    context.fillStyle = "#FFFFFF";
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2, boxY + 17 + lineHeight * index + lineHeight / 2, canvas.width - 90));
    context.restore();
  }

  async function captureSourceAudio() {
    const captureMethod = typeof sourceVideo.captureStream === "function"
      ? sourceVideo.captureStream
      : typeof sourceVideo.mozCaptureStream === "function"
        ? sourceVideo.mozCaptureStream
        : null;

    if (captureMethod) {
      try {
        const stream = captureMethod.call(sourceVideo);
        if (stream.getAudioTracks().length) return { stream, cleanup: null };
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // Fall through to Web Audio for engines that expose but cannot use captureStream().
      }
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioContextConstructor !== "function") {
      throw new Error("لا يدعم هذا المتصفح التقاط صوت الفيديو مباشرة أو عبر Web Audio؛ لم يتم إنشاء ملف ناقص الصوت.");
    }

    if (!fallbackAudioContext || fallbackAudioContext.state === "closed") {
      fallbackAudioContext = new AudioContextConstructor();
      fallbackAudioSource = fallbackAudioContext.createMediaElementSource(sourceVideo);
      // Keep normal preview audio audible after the media element is routed through Web Audio.
      fallbackAudioSource.connect(fallbackAudioContext.destination);
    }

    const destination = fallbackAudioContext.createMediaStreamDestination();
    fallbackAudioSource.connect(destination);
    await fallbackAudioContext.resume();

    return {
      stream: destination.stream,
      cleanup: () => {
        try { fallbackAudioSource.disconnect(destination); } catch {}
        destination.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }

  function supportedRecorderType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4"
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function exportShort() {
    if (!selectedFile || exporting) return;
    let bounds;
    try {
      bounds = clipBounds();
      validateCaptions(bounds.duration, true);
    } catch (error) {
      setStatus(error.message, "error");
      return;
    }
    const hasCanvasCapture = typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
    const hasAudioCapture = typeof sourceVideo.captureStream === "function"
      || typeof sourceVideo.mozCaptureStream === "function"
      || typeof (window.AudioContext || window.webkitAudioContext) === "function";
    if (typeof MediaRecorder === "undefined" || !hasCanvasCapture || !hasAudioCapture) {
      setStatus("متصفحك لا يوفّر أدوات تسجيل الفيديو العمودي أو التقاط الصوت اللازمة للتصدير. لم يتم إنشاء ملف ناقص.", "error");
      return;
    }
    const mimeType = supportedRecorderType();
    if (!mimeType) {
      setStatus("لا توجد صيغة تسجيل مدعومة في هذا المتصفح؛ لم يتم إنشاء ملف.", "error");
      return;
    }
    resetOutput();
    setBusy(true);
    progress.hidden = false;
    progress.value = 0;
    setStatus("يُجهّز التصدير المحلي. لا تغلق الصفحة حتى يكتمل التسجيل.", "info");
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 1280;
    const context = canvas.getContext("2d");
    if (!context) {
      setBusy(false);
      setStatus("تعذّر إنشاء مساحة رسم الفيديو في هذا المتصفح.", "error");
      return;
    }
    let sourceStream;
    let audioCaptureCleanup = null;
    let outputStream;
    let recorder;
    let animationId = 0;
    let stopTimer = 0;
    let timedOut = false;
    const chunks = [];
    try {
      // Initialize/resume Web Audio before any media seek await can consume the
      // browser's transient user activation (required by Safari's audio policy).
      const audioCapture = await captureSourceAudio();
      sourceStream = audioCapture.stream;
      audioCaptureCleanup = audioCapture.cleanup;
      sourceVideo.pause();
      if (Math.abs(sourceVideo.currentTime - bounds.start) > 0.05) {
        const seeked = waitForMediaEvent(sourceVideo, "seeked");
        sourceVideo.currentTime = bounds.start;
        await seeked;
      }
      outputStream = canvas.captureStream(30);
      const audioTracks = sourceStream.getAudioTracks();
      if (!audioTracks.length) throw new Error("لم يتمكن المتصفح من تجهيز مسار صوت للمقطع؛ أوقفنا التصدير بدل إنشاء فيديو صامت.");
      audioTracks.forEach((track) => outputStream.addTrack(track.clone()));
      recorder = new MediaRecorder(outputStream, { mimeType, videoBitsPerSecond: 5000000, audioBitsPerSecond: 128000 });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener("error", () => reject(new Error("توقف تسجيل الفيديو بسبب خطأ في المتصفح.")), { once: true });
      });
      const drawFrame = () => {
        drawCover(context, sourceVideo, canvas);
        drawActiveCaption(context, canvas, sourceVideo.currentTime - bounds.start);
        const elapsed = Math.max(0, sourceVideo.currentTime - bounds.start);
        progress.value = Math.min(100, Math.round(elapsed / bounds.duration * 100));
        if (sourceVideo.currentTime >= bounds.end - 0.03) {
          sourceVideo.pause();
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }
        animationId = requestAnimationFrame(drawFrame);
      };
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.start(250);
      await sourceVideo.play();
      drawFrame();
      stopTimer = window.setTimeout(() => {
        if (recorder && recorder.state !== "inactive") {
          timedOut = sourceVideo.currentTime < bounds.end - 0.5;
          sourceVideo.pause();
          recorder.stop();
        }
      }, (bounds.duration + 30) * 1000);
      await stopped;
      window.clearTimeout(stopTimer);
      cancelAnimationFrame(animationId);
      if (timedOut) throw new Error("انتهت مهلة التصدير قبل اكتمال المقطع. أبقِ الصفحة نشطة وجرّب مقطعًا أقصر.");
      if (!chunks.length) throw new Error("لم يُنتج المتصفح بيانات فيديو. جرّب متصفحًا آخر أو ملفًا أقصر.");
      const blob = new Blob(chunks, { type: mimeType });
      if (!blob.size) throw new Error("ملف التصدير فارغ؛ لم يتم تقديم رابط تنزيل.");
      outputUrl = URL.createObjectURL(blob);
      outputVideo.src = outputUrl;
      outputVideo.hidden = false;
      downloadVideo.href = outputUrl;
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      downloadVideo.download = cleanFileName(selectedFile.name) + "-short." + extension;
      downloadVideo.textContent = "تنزيل الفيديو (" + extension.toUpperCase() + ")";
      downloadVideo.hidden = false;
      progress.value = 100;
      exportMeta.textContent = "تم إنشاء " + extension.toUpperCase() + " — " + (blob.size / (1024 * 1024)).toFixed(1) + " MB — " + formatTime(bounds.duration) + ".";
      setStatus("اكتمل التصدير محليًا. راجع الملف قبل نشره على أي منصة.", "success");
    } catch (error) {
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch {}
      }
      setStatus(error.message || "تعذّر تصدير الفيديو. لم يتم إنشاء رابط تنزيل صالح.", "error");
    } finally {
      window.clearTimeout(stopTimer);
      cancelAnimationFrame(animationId);
      if (audioCaptureCleanup) audioCaptureCleanup();
      if (sourceStream) sourceStream.getTracks().forEach((track) => track.stop());
      if (outputStream) outputStream.getTracks().forEach((track) => track.stop());
      sourceVideo.pause();
      setBusy(false);
      if (selectedFile) {
        detectButton.disabled = false;
        addCaptionButton.disabled = false;
        exportButton.disabled = false;
      }
    }
  }

  exportButton.addEventListener("click", exportShort);

  window.addEventListener("beforeunload", () => {
    cancelAnimationFrame(scanFrameId);
    revokeUrl(sourceUrl);
    revokeUrl(outputUrl);
    if (fallbackAudioContext && fallbackAudioContext.state !== "closed") {
      fallbackAudioContext.close().catch(() => {});
    }
  });
})();