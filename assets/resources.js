(() => {
  "use strict";
  const root = document.querySelector("#published-library");
  const status = document.querySelector("#library-status");
  const config = window.ATHAR_SUPABASE_CONFIG || {};
  const labels = { lesson: "درس", video: "فيديو", pdf: "ملف PDF", worksheet: "ورقة تدريب", link: "رابط" };
  const courseLabels = { tasees: "تأسيس", tadreebat: "تدريبات" };
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function say(text, bad = false) {
    if (!status) return;
    status.textContent = text;
    status.setAttribute("role", bad ? "alert" : "status");
  }
  async function load() {
    if (!root || !config.url || !config.publishableKey || !window.supabase?.createClient) {
      say("تعذر الاتصال بمكتبة المحتوى الآن. حاول مرة أخرى لاحقًا.", true);
      return;
    }
    root.replaceChildren();
    say("جارٍ تحميل المواد المنشورة…");
    const client = window.supabase.createClient(config.url, config.publishableKey);
    const { data, error } = await client.from("course_content")
      .select("id,title,description,content_type,course_slug,storage_path,external_url,created_at")
      .eq("is_published", true).order("created_at", { ascending: false }).limit(100);
    if (error) {
      say("لم نتمكن من تحميل المواد المنشورة. يرجى إعادة المحاولة.", true);
      return;
    }
    const items = data || [];
    if (!items.length) {
      say("لا توجد ملفات أو مقاطع منشورة حتى الآن. يمكنك متابعة التعلّم من الدورات والتدريب إلى أن تنشر الإدارة مواد المكتبة.");
      const empty = node("article", undefined, "card empty-resource-state");
      empty.append(
        node("h2", "المكتبة تستعد لاستقبال موادك التعليمية"),
        node("p", "لم تُنشر ملفات أو روابط تعليمية بعد. هذه ليست مشكلة اتصال؛ قاعدة البيانات تعمل، لكن لا توجد مواد منشورة حاليًا.")
      );
      const actions = node("div", undefined, "resource-empty-actions");
      const courses = node("a", "استكشف الدورات", "btn");
      courses.href = "courses.html";
      const practice = node("a", "ابدأ التدريب", "btn secondary");
      practice.href = "practice.html";
      actions.append(courses, practice);
      empty.append(actions);
      root.append(empty);
      return;
    }
    let ready = 0;
    for (const item of items) {
      const card = node("article", undefined, "card published-resource");
      const top = node("div", undefined, "resource-meta");
      top.append(node("span", labels[item.content_type] || "مادة تعليمية", "pill"));
      top.append(node("span", courseLabels[item.course_slug] || "أثَر", "pill"));
      card.append(top, node("h2", item.title));
      if (item.description) card.append(node("p", item.description));
      if (item.storage_path) {
        const { data: signed, error: signError } = await client.storage
          .from("athar-content").createSignedUrl(item.storage_path, 300, { download: false });
        if (signError || !signed?.signedUrl) {
          card.append(node("p", "الملف غير متاح مؤقتًا. أبلغ إدارة المنصة.", "muted"));
        } else if (item.content_type === "video") {
          const video = node("video", undefined, "published-video");
          video.controls = true;
          video.preload = "metadata";
          video.playsInline = true;
          video.src = signed.signedUrl;
          video.setAttribute("aria-label", "مقطع تعليمي: " + item.title);
          card.append(video);
          const open = node("a", "فتح الفيديو في نافذة مستقلة", "btn");
          open.href = signed.signedUrl; open.target = "_blank"; open.rel = "noopener noreferrer";
          card.append(open);
        } else {
          const open = node("a", item.content_type === "pdf" ? "عرض ملف PDF" : "فتح / تنزيل الملف", "btn");
          open.href = signed.signedUrl; open.target = "_blank"; open.rel = "noopener noreferrer";
          card.append(open);
        }
      } else if (item.external_url) {
        const link = node("a", "فتح المادة", "btn");
        link.href = item.external_url; link.target = "_blank"; link.rel = "noopener noreferrer";
        card.append(link);
      }
      root.append(card);
      ready++;
    }
    say("تم عرض " + ready + " مادة منشورة. روابط الملفات آمنة ومؤقتة لمدة 5 دقائق.");
  }
  load().catch(() => say("حدث خطأ غير متوقع أثناء تحميل المكتبة.", true));
})();