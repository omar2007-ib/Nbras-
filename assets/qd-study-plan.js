(() => {
  "use strict";

  const STORAGE_KEY = "athar-qd-study-plan-v1";
  const number = value => new Intl.NumberFormat("ar-SA").format(value);

  const alternatingPlan = [
    {"day":1,"track":"quant","session":1,"topic":"العمليات والكسور","task":"حل 15 سؤالًا على ترتيب العمليات والكسور."},
    {"day":2,"track":"verbal","session":1,"topic":"التناظر اللفظي","task":"حل 15 سؤالًا وحدّد العلاقة بين كل زوج."},
    {"day":3,"track":"quant","session":2,"topic":"النسب والتناسب","task":"حل 15 سؤالًا على النسبة والتناسب."},
    {"day":4,"track":"verbal","session":2,"topic":"إكمال الجمل","task":"حل 15 سؤالًا واختر الكلمة الأنسب للسياق."},
    {"day":5,"track":"quant","session":3,"topic":"النسبة المئوية","task":"حل 15 سؤالًا على النسبة والزيادة والخصم."},
    {"day":6,"track":"verbal","session":3,"topic":"الخطأ السياقي","task":"حل 15 سؤالًا وراجع معنى الكلمة داخل الجملة."},
    {"day":7,"track":"quant","session":4,"topic":"المتوسط الحسابي","task":"حل 15 سؤالًا على المتوسط والمجموع."},
    {"day":8,"track":"verbal","session":4,"topic":"استيعاب المقروء","task":"اقرأ نصين وأجب عن أسئلة الفكرة والتفاصيل."},
    {"day":9,"track":"quant","session":5,"topic":"الأسس والجذور","task":"حل 15 سؤالًا على قوانين الأسس والجذور."},
    {"day":10,"track":"verbal","session":5,"topic":"المفردة المختلفة","task":"حل 15 سؤالًا على الكلمة غير المتجانسة."},
    {"day":11,"track":"quant","session":6,"topic":"المعادلات الخطية","task":"حل 15 سؤالًا على المعادلات ذات المجهول الواحد."},
    {"day":12,"track":"verbal","session":6,"topic":"التناظر اللفظي المتقدم","task":"حل 15 سؤالًا على العلاقات اللفظية المركبة."},
    {"day":13,"track":"quant","session":7,"topic":"المتباينات والقيم","task":"حل 15 سؤالًا على المقارنة والمتباينات."},
    {"day":14,"track":"verbal","session":7,"topic":"إكمال الجمل المتقدم","task":"حل 15 سؤالًا مع مراعاة ترابط الجملة."},
    {"day":15,"track":"quant","session":8,"topic":"التبسيط والتحليل","task":"حل 15 سؤالًا على تبسيط العبارات والتحليل."},
    {"day":16,"track":"verbal","session":8,"topic":"الاستنتاج من النص","task":"اقرأ نصين واستخرج النتائج التي يدعمها النص."},
    {"day":17,"track":"quant","session":9,"topic":"الزوايا والمثلثات","task":"حل 15 سؤالًا على الزوايا وخصائص المثلث."},
    {"day":18,"track":"verbal","session":9,"topic":"العلاقات بين الكلمات","task":"حل 15 سؤالًا وميّز السبب والنتيجة والجزء والكل."},
    {"day":19,"track":"quant","session":10,"topic":"المحيط والمساحة","task":"حل 15 سؤالًا على المحيط والمساحة."},
    {"day":20,"track":"verbal","session":10,"topic":"الخطأ السياقي — مراجعة","task":"حل 15 سؤالًا واكتب الكلمات التي أخطأت فيها."},
    {"day":21,"track":"quant","session":11,"topic":"الدائرة والأشكال","task":"حل 15 سؤالًا على الدائرة والأشكال الهندسية."},
    {"day":22,"track":"verbal","session":11,"topic":"المفردة المختلفة — مراجعة","task":"حل 15 سؤالًا وراجع سبب اختلاف كل إجابة."},
    {"day":23,"track":"quant","session":12,"topic":"الاحتمالات والإحصاء","task":"حل 15 سؤالًا على الاحتمالات والجداول."},
    {"day":24,"track":"verbal","session":12,"topic":"استيعاب المقروء — تدريب","task":"أجب عن أسئلة الفكرة الرئيسة والاستنتاج."},
    {"day":25,"track":"quant","session":13,"topic":"السرعة والزمن والعمل","task":"حل 15 سؤالًا على السرعة والزمن ومعدلات الإنجاز."},
    {"day":26,"track":"verbal","session":13,"topic":"إكمال الجمل — مراجعة","task":"حل 15 سؤالًا وراجع دلالة أدوات الربط."},
    {"day":27,"track":"quant","session":14,"topic":"المقارنة الكمية","task":"حل 20 سؤالًا متنوعًا مع تحديد طريقة الحل الأسرع."},
    {"day":28,"track":"verbal","session":14,"topic":"تدريب لفظي مختلط","task":"حل مجموعة مختلطة وراجع جميع الإجابات الخاطئة."},
    {"day":29,"track":"quant","session":15,"topic":"اختبار كمي مؤقت","task":"حل 60 سؤالًا خلال 60 دقيقة ثم سجّل الدرجة."},
    {"day":30,"track":"verbal","session":15,"topic":"اختبار لفظي ومراجعة","task":"حل مجموعة لفظية مؤقتة ثم راجع الأخطاء المتكررة."}
  ];

  const quantSprint = [
    {"day":1,"topic":"العمليات والكسور","task":"حل 20 سؤالًا على ترتيب العمليات والكسور."},
    {"day":2,"topic":"النسب والتناسب","task":"حل 20 سؤالًا على النسب والتناسب."},
    {"day":3,"topic":"النسبة المئوية","task":"حل 20 سؤالًا على النسبة والزيادة والخصم."},
    {"day":4,"topic":"المتوسط الحسابي","task":"حل 20 سؤالًا على المتوسط والمجموع."},
    {"day":5,"topic":"الأسس والجذور","task":"حل 20 سؤالًا على الأسس والجذور."},
    {"day":6,"topic":"المعادلات الخطية","task":"حل 20 سؤالًا على المعادلات."},
    {"day":7,"topic":"المتباينات والقيم","task":"حل 20 سؤالًا على المقارنة والمتباينات."},
    {"day":8,"topic":"التبسيط والتحليل","task":"حل 20 سؤالًا على تبسيط العبارات والتحليل."},
    {"day":9,"topic":"الزوايا والمثلثات","task":"حل 20 سؤالًا على الزوايا والمثلثات."},
    {"day":10,"topic":"المحيط والمساحة","task":"حل 20 سؤالًا على المحيط والمساحة."},
    {"day":11,"topic":"الدائرة والأشكال","task":"حل 20 سؤالًا على الدائرة والأشكال الهندسية."},
    {"day":12,"topic":"الاحتمالات والإحصاء","task":"حل 20 سؤالًا على الاحتمالات والجداول."},
    {"day":13,"topic":"السرعة والزمن والعمل","task":"حل 20 سؤالًا على السرعة والزمن ومعدلات الإنجاز."},
    {"day":14,"topic":"مراجعة الأخطاء","task":"حل مجموعة مختلطة وأعد حل الأسئلة التي أخطأت فيها."},
    {"day":15,"topic":"اختبار كمي شامل","task":"حل 60 سؤالًا خلال 60 دقيقة ثم سجّل الدرجة."}
  ];

  const emptyState = () => ({ alternating: [], quantSprint: [] });
  let state = emptyState();
  let storageReadable = true;

  function normalizeDays(value, max) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(day => Number.isInteger(day) && day >= 1 && day <= max))].sort((a, b) => a - b);
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        alternating: normalizeDays(raw.alternating, 30),
        quantSprint: normalizeDays(raw.quantSprint, 15)
      };
    } catch (_) {
      storageReadable = false;
      return emptyState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        alternating: normalizeDays(state.alternating, 30),
        quantSprint: normalizeDays(state.quantSprint, 15)
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function setProgress(textId, barId, count, max) {
    const text = document.getElementById(textId);
    const bar = document.getElementById(barId);
    if (!text || !bar) return;
    text.textContent = number(count) + " / " + number(max);
    bar.style.width = (count / max * 100) + "%";
    bar.parentElement.setAttribute("aria-valuenow", String(count));
  }

  function updateProgress() {
    const total = state.alternating.length;
    const quant = alternatingPlan.filter(item => item.track === "quant" && state.alternating.includes(item.day)).length;
    const verbal = alternatingPlan.filter(item => item.track === "verbal" && state.alternating.includes(item.day)).length;
    setProgress("qd-plan-total", "qd-plan-total-bar", total, 30);
    setProgress("qd-plan-quant", "qd-plan-quant-bar", quant, 15);
    setProgress("qd-plan-verbal", "qd-plan-verbal-bar", verbal, 15);
    setProgress("qd-sprint-total", "qd-sprint-bar", state.quantSprint.length, 15);
  }

  function makeDayCard(item, key, track) {
    const completed = state[key].includes(item.day);
    const card = document.createElement("article");
    card.className = "qd-plan__day" + (completed ? " is-done" : "");

    const top = document.createElement("div");
    top.className = "qd-plan__day-top";
    const label = document.createElement("label");
    label.className = "qd-plan__check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;
    checkbox.setAttribute("aria-label", "إتمام اليوم " + number(item.day) + " — " + item.topic);
    const dayText = document.createElement("span");
    dayText.textContent = "اليوم " + number(item.day);
    label.append(checkbox, dayText);
    top.append(label);

    if (track) {
      const badge = document.createElement("span");
      badge.className = "qd-plan__track qd-plan__track--" + track;
      badge.textContent = (track === "quant" ? "كمي" : "لفظي") + " · جلسة " + number(item.session);
      top.append(badge);
    }

    const title = document.createElement("h3");
    title.textContent = item.topic;
    const task = document.createElement("p");
    task.textContent = item.task;
    card.append(top, title, task);

    checkbox.addEventListener("change", () => {
      const values = new Set(state[key]);
      if (checkbox.checked) values.add(item.day);
      else values.delete(item.day);
      state[key] = [...values].sort((a, b) => a - b);
      card.classList.toggle("is-done", checkbox.checked);
      updateProgress();
      const saved = saveState();
      const status = document.getElementById("qd-plan-status");
      if (status) {
        status.textContent = saved
          ? "تم تحديث التقدّم وحفظه على هذا الجهاز."
          : "تعذّر حفظ التقدّم في المتصفح؛ سيبقى التغيير مؤقتًا حتى مغادرة الصفحة.";
      }
    });

    return card;
  }

  function render() {
    const mainDays = document.getElementById("qd-plan-days");
    const sprintDays = document.getElementById("qd-quant-sprint-days");
    if (!mainDays || !sprintDays) return;
    mainDays.replaceChildren(...alternatingPlan.map(item => makeDayCard(item, "alternating", item.track)));
    sprintDays.replaceChildren(...quantSprint.map(item => makeDayCard(item, "quantSprint", null)));
    updateProgress();
    const status = document.getElementById("qd-plan-status");
    if (status && !storageReadable) {
      status.textContent = "تعذّر قراءة التقدّم السابق من المتصفح؛ يمكنك متابعة الخطة لكن قد لا تُحفظ التغييرات.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    state = loadState();
    render();
    const reset = document.getElementById("qd-plan-reset");
    reset?.addEventListener("click", () => {
      if (!window.confirm("هل تريد مسح تقدّم خطة الثلاثين يومًا ومسار الكمي المكثّف؟")) return;
      state = emptyState();
      render();
      const saved = saveState();
      const status = document.getElementById("qd-plan-status");
      if (status) {
        status.textContent = saved
          ? "تم مسح تقدّم الخطتين على هذا الجهاز."
          : "تم مسح التقدّم من الشاشة، لكن تعذّر تحديث التخزين المحلي.";
      }
    });
  });
})(); 
