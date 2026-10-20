/* Athar in-app notification center.
   Current release stores read state on this browser only; server/push notifications require backend integration. */
(() => {
  "use strict";
  const KEY = "athar.notifications.v1";
  const defaults = [
    { id: "welcome", title: "مرحبًا بك في أثَر", body: "ابدأ بمسار التأسيس، ثم انتقل إلى التدريب حسب استعدادك.", date: "رسالة إرشادية", read: false },
    { id: "study-tip", title: "خطوة مذاكرة صغيرة", body: "خصّص وقتًا لمراجعة أخطائك بعد كل تدريب؛ فالمراجعة جزء من التعلّم.", date: "نصيحة دراسية", read: false },
    { id: "practice-tip", title: "تدرّب بثقة", body: "يمكنك تجربة الأسئلة المتاحة الآن من صفحة التدريب.", date: "تلميح المنصة", read: false }
  ];
  const safeLoad = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      return Array.isArray(saved) ? saved : defaults.map(item => ({ ...item }));
    } catch (_) {
      return defaults.map(item => ({ ...item }));
    }
  };
  const save = items => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) { /* Private browsing may block storage. */ }
  };
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const mount = () => {
    const header = document.querySelector("header");
    if (!header || document.querySelector("[data-athar-notifications]")) return;
    const items = safeLoad();
    const wrapper = document.createElement("div");
    wrapper.className = "athar-notification";
    wrapper.dataset.atharNotifications = "true";
    wrapper.innerHTML = `
      <button class="athar-notification__toggle" type="button" aria-expanded="false" aria-controls="athar-notification-panel" aria-label="فتح الإشعارات">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        <span>الإشعارات</span><span class="athar-notification__count" aria-label="إشعارات غير مقروءة"></span>
      </button>
      <section class="athar-notification__panel" id="athar-notification-panel" aria-label="مركز الإشعارات" hidden>
        <div class="athar-notification__head"><h2>مركز الإشعارات</h2><button type="button" class="athar-notification__mark">تحديد الكل كمقروء</button></div>
        <div class="athar-notification__list" aria-live="polite"></div>
        <p class="athar-notification__foot">حالة القراءة محفوظة على هذا الجهاز فقط في النسخة الحالية.</p>
      </section>`;
    const nav = header.querySelector("nav");
    if (nav) nav.insertAdjacentElement("afterend", wrapper);
    else header.appendChild(wrapper);
    const toggle = wrapper.querySelector(".athar-notification__toggle");
    const panel = wrapper.querySelector(".athar-notification__panel");
    const list = wrapper.querySelector(".athar-notification__list");
    const count = wrapper.querySelector(".athar-notification__count");
    const render = () => {
      const unread = items.filter(item => !item.read).length;
      count.textContent = unread ? String(unread) : "";
      count.hidden = !unread;
      list.innerHTML = items.length ? items.map(item => `
        <article class="athar-notification__item ${item.read ? "is-read" : "is-unread"}">
          <span class="athar-notification__dot" aria-hidden="true"></span>
          <div><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p><small>${esc(item.date)}</small></div>
          <button type="button" class="athar-notification__read" data-read="${esc(item.id)}" ${item.read ? "disabled" : ""}>${item.read ? "مقروء" : "قراءة"}</button>
        </article>`).join("") : '<p class="athar-notification__empty">لا توجد إشعارات حاليًا.</p>';
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      if (open) wrapper.querySelector(".athar-notification__mark").focus();
    });
    wrapper.addEventListener("click", event => {
      const readButton = event.target.closest("[data-read]");
      if (readButton) {
        const item = items.find(entry => entry.id === readButton.dataset.read);
        if (item) item.read = true;
        save(items); render();
      }
    });
    wrapper.querySelector(".athar-notification__mark").addEventListener("click", () => {
      items.forEach(item => { item.read = true; });
      save(items); render();
    });
    document.addEventListener("click", event => {
      if (!wrapper.contains(event.target) && !panel.hidden) {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
    render();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();