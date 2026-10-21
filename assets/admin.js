(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const config = window.ATHAR_SUPABASE_CONFIG || {};
  const form = $("#content-form");
  const message = $("#form-message");
  const table = $("#items");
  const empty = $("#empty");
  const submit = form?.querySelector('button[type="submit"]');
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const typeSelect = $("#content-form select[name=\"type\"]");
  const externalUrlField = $("#external-url-field");
  const fileUploadField = $("#file-upload-field");
  const externalUrlInput = $("#content-form input[name=\"external_url\"]");
  function syncResourceFields() {
    const isLink = typeSelect?.value === "link";
    if (externalUrlField) externalUrlField.style.display = isLink ? "block" : "none";
    if (fileUploadField) fileUploadField.hidden = isLink;
    if (externalUrlInput) externalUrlInput.required = Boolean(isLink);
    const fileInput = $("#files");
    if (fileInput) fileInput.required = !isLink;
  }
  typeSelect?.addEventListener("change", syncResourceFields);
  syncResourceFields();
  const MIME = {
    pdf: ["application/pdf"],
    video: ["video/mp4", "video/webm"],
    image: ["image/jpeg", "image/png", "image/webp"],
    worksheet: ["application/pdf", "image/jpeg", "image/png", "image/webp"]
  };
  let client, user, rows = [];

  function say(text, bad = false) {
    if (!message) return;
    message.textContent = text;
    message.style.color = bad ? "#9b2424" : "";
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function authRedirect() {
    const next = encodeURIComponent("admin.html");
    window.location.replace("auth.html?next=" + next);
  }
  async function start() {
    if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
      say("إعدادات الاتصال غير مكتملة. راجع رابط Supabase والمفتاح العام ومكتبة الدخول.", true);
      if (submit) submit.disabled = true;
      return;
    }
    client = window.supabase.createClient(config.url, config.publishableKey);
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.user) return authRedirect();
    user = session.user;
    const { data: profile, error: profileError } = await client
      .from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
    if (profileError || !profile || !["owner", "admin"].includes(profile.role)) {
      document.querySelector("main").innerHTML = '<section class="card"><h1>لا تملك صلاحية إدارة المحتوى</h1><p>تتطلب هذه الصفحة دور المالك أو المدير. لا يمكن تغيير الدور من هذه الواجهة.</p><button id="signout" class="btn" type="button">تسجيل الخروج</button></section>';
      $("#signout")?.addEventListener("click", async () => { await client.auth.signOut(); window.location.replace("index.html"); });
      return;
    }
    const welcome = document.createElement("p");
    welcome.className = "muted";
    welcome.textContent = "مرحباً " + (profile.display_name || user.email || "بك") + " — صلاحيتك: " + (profile.role === "owner" ? "المالك" : "المدير");
    document.querySelector(".main h1")?.after(welcome);
    const signout = document.createElement("button");
    signout.type = "button"; signout.className = "btn"; signout.textContent = "تسجيل الخروج";
    signout.addEventListener("click", async () => { await client.auth.signOut(); window.location.replace("index.html"); });
    document.querySelector(".main h1")?.parentElement?.append(signout);
    form?.addEventListener("submit", uploadContent);
    await loadContent();
  }
  async function loadContent() {
    say("جارٍ تحميل المكتبة…");
    const { data, error } = await client.from("course_content")
      .select("id,title,description,content_type,course_slug,storage_path,external_url,is_published,created_at")
      .order("created_at", { ascending: false }).limit(250);
    if (error) { say("تعذر تحميل المحتوى: " + error.message, true); return; }
    rows = data || [];
    render();
    const dashboardStatus = $("#dashboard-status");
    if (dashboardStatus) dashboardStatus.textContent = "تم تحديث بيانات المحتوى من قاعدة البيانات.";
    const publishedCount = $("#published-count");
    if (publishedCount) publishedCount.textContent = String(rows.filter(x => x.is_published).length);
    const mcqCount = $("#mcq-count");
    if (mcqCount) {
      const { count, error: countError } = await client.from("mcq_questions").select("id", { count: "exact", head: true });
      mcqCount.textContent = countError ? "غير متاح" : String(count || 0);
    }
    say("تم تحميل " + rows.length + " عنصر من قاعدة البيانات.");
  }
  function render() {
    table.replaceChildren();
    const term = String($("#search")?.value || "").trim().toLocaleLowerCase("ar");
    const selectedCourse = $("#filter-course")?.value || "";
    const visibleRows = rows.filter(row => {
      const haystack = [row.title, row.description, row.content_type, row.course_slug].join(" ").toLocaleLowerCase("ar");
      const courseName = row.course_slug === "tasees" ? "تأسيس" : "تدريبات";
      return (!term || haystack.includes(term)) && (!selectedCourse || selectedCourse === courseName);
    });
    for (const row of visibleRows) {
      const tr = document.createElement("tr");
      const cells = [
        row.title,
        ({lesson:"درس",video:"فيديو",pdf:"PDF",worksheet:"ورقة تدريب",link:"رابط"})[row.content_type] || row.content_type,
        row.course_slug === "tasees" ? "تأسيس" : "تدريبات",
        row.description || "—",
        row.is_published ? "منشور" : "مسودة"
      ];
      for (const value of cells) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
      const actions = document.createElement("td");
      if (row.storage_path) {
        const preview = document.createElement("button");
        preview.type = "button"; preview.className = "btn small-btn";
        preview.textContent = row.content_type === "video" ? "مشاهدة" : "فتح الملف";
        preview.addEventListener("click", () => previewFile(row, preview));
        actions.append(preview);
      } else if (row.external_url) {
        const external = document.createElement("a");
        try {
          const url = new URL(row.external_url);
          if (url.protocol !== "https:") throw new Error("protocol");
          external.href = url.toString();
          external.target = "_blank";
          external.rel = "noopener noreferrer";
          external.className = "btn small-btn";
          external.textContent = "فتح الرابط";
          actions.append(external);
        } catch (_) { say("الرابط المخزن غير صالح أو غير آمن.", true); }
      }
      const publish = document.createElement("button");
      publish.type = "button"; publish.className = "btn small-btn";
      publish.textContent = row.is_published ? "إلغاء النشر" : "نشر";
      publish.addEventListener("click", () => setPublished(row, !row.is_published, publish));
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn small-btn"; del.style.marginInlineStart = "6px";
      del.textContent = "حذف"; del.addEventListener("click", () => removeRow(row, del));
      actions.append(publish, del); tr.append(actions); table.append(tr);
    }
    empty.hidden = visibleRows.length > 0;
    empty.textContent = rows.length ? "لا توجد نتائج تطابق البحث الحالي." : "لا يوجد محتوى مضاف حتى الآن.";
    $("#count").textContent = String(rows.length);
    $("#file-count").textContent = String(rows.filter(x => x.storage_path).length);
  }
  async function uploadContent(event) {
    event.preventDefault();
    const data = new FormData(form);
    const files = Array.from($("#files")?.files || []);
    const title = String(data.get("title") || "").trim();
    const kind = String(data.get("type") || "lesson");
    const course = data.get("course") === "تدريبات" ? "tadreebat" : "tasees";
    const description = String(data.get("description") || "").trim();
    const externalUrl = String(data.get("external_url") || "").trim();
    if (!title) return say("اكتب عنوان المحتوى أولاً.", true);
    if (kind === "link") {
      let parsedUrl;
      try { parsedUrl = new URL(externalUrl); } catch (_) { return say("اكتب رابطًا صحيحًا يبدأ بـ https://.", true); }
      if (parsedUrl.protocol !== "https:") return say("لأمان الطلاب، يجب أن يبدأ الرابط بـ https://.", true);
      if (files.length) return say("أزل الملفات المختارة قبل إضافة رابط خارجي.", true);
    } else if (!files.length) return say("اختر ملفًا أو أكثر لرفعه.", true);
    if (files.some(file => file.size > MAX_FILE_SIZE)) return say("حجم كل ملف يجب ألا يتجاوز 50 ميجابايت في إعداد التخزين الحالي.", true);
    if (files.some(file => !allowedFile(file, kind))) return say("نوع الملف لا يطابق التصنيف المختار. اختر فيديو لـ MP4/WebM أو PDF أو ورقة تدريب للملفات والصور المناسبة.", true);
    if (files.length > 20) return say("يمكن رفع 20 ملفًا كحد أقصى في العملية الواحدة.", true);
    submit.disabled = true;
    const fileInput = $("#files");
    if (fileInput) fileInput.disabled = true;
    let uploaded = 0;
    let failedFile = "";
    try {
      if (kind === "link") {
        const { error } = await client.from("course_content").insert({
          course_slug: course, title, description, content_type: "link",
          storage_path: null, external_url: externalUrl,
          is_published: data.get("is_published") === "on", created_by: user.id
        });
        if (error) throw error;
        form.reset();
        syncResourceFields();
        await loadContent();
        return say("تمت إضافة الرابط الخارجي " + (data.get("is_published") === "on" ? "ونشره" : "وحفظه كمسودة") + " بنجاح.");
      }
      for (const [index, file] of files.entries()) {
        const safeName = file.name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-100) || "file";
        const path = course + "/" + user.id + "/" + crypto.randomUUID() + "-" + safeName;
        const { error: uploadError } = await client.storage.from("athar-content").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream"
        });
        if (uploadError) throw uploadError;
        const contentType = inferContentType(file, kind);
        const { error: insertError } = await client.from("course_content").insert({
          course_slug: course,
          title: files.length > 1 ? title + " — " + file.name : title,
          description, content_type: contentType, storage_path: path,
          external_url: null, is_published: data.get("is_published") === "on", created_by: user.id
        });
        if (insertError) {
          await client.storage.from("athar-content").remove([path]);
          throw insertError;
        }
        uploaded++;
        say("جارٍ الرفع: " + uploaded + " من " + files.length + " ملف — " + Math.round(uploaded / files.length * 100) + "%");
      }
      form.reset();
      await loadContent();
      say("اكتمل رفع " + uploaded + " ملف بنجاح. الملفات محفوظة في التخزين الخاص.");
    } catch (error) {
      failedFile = files[uploaded]?.name || "";
      await loadContent();
      const partial = uploaded ? " نجح رفع " + uploaded + " ملف، ولم يكتمل باقي الرفع." : "لم يتم رفع أي ملف.";
      say(partial + (failedFile ? " الملف المتعثر: " + failedFile + "." : "") + " السبب: " + (error?.message || "خطأ غير معروف"), true);
    } finally {
      submit.disabled = false;
      if (fileInput) fileInput.disabled = false;
    }
  }
  function allowedFile(file, kind) {
    const allowedByKind = {
      video: MIME.video, pdf: MIME.pdf, worksheet: MIME.worksheet,
      lesson: [...MIME.pdf, ...MIME.image],
      other: [...MIME.pdf, ...MIME.video, ...MIME.image]
    };
    return (allowedByKind[kind] || []).includes(file.type);
  }
  function inferContentType(file, kind) {
    if (kind === "video" || MIME.video.includes(file.type)) return "video";
    if (kind === "pdf" || file.type === "application/pdf") return "pdf";
    if (kind === "worksheet") return "worksheet";
    return "lesson";
  }
  async function previewFile(row, button) {
    button.disabled = true;
    try {
      const { data, error } = await client.storage.from("athar-content").createSignedUrl(row.storage_path, 300, { download: false });
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("لم يتم إنشاء رابط معاينة آمن.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      say("تم إنشاء رابط معاينة مؤقت صالح لمدة 5 دقائق.");
    } catch (error) {
      say("تعذرت معاينة الملف: " + (error?.message || "خطأ غير معروف"), true);
    } finally { button.disabled = false; }
  }
  async function setPublished(row, value, button) {
    if (button) button.disabled = true;
    const { error } = await client.from("course_content").update({ is_published: value, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (button) button.disabled = false;
    if (error) return say("تعذر تحديث حالة النشر: " + error.message, true);
    await loadContent();
    say(value ? "تم نشر المحتوى." : "تم إلغاء النشر؛ المحتوى محفوظ كمسودة.");
  }
  async function removeRow(row, button) {
    if (!confirm("هل تريد حذف هذا المحتوى نهائيًا؟ لا يمكن التراجع عن الحذف.")) return;
    if (button) button.disabled = true;
    const { error: deleteError } = await client.from("course_content").delete().eq("id", row.id);
    if (deleteError) {
      if (button) button.disabled = false;
      return say("تعذر حذف سجل المحتوى: " + deleteError.message, true);
    }
    if (row.storage_path) {
      const { error: storageError } = await client.storage.from("athar-content").remove([row.storage_path]);
      if (storageError) {
        await loadContent();
        return say("حُذف سجل المحتوى لكن تعذر تنظيف الملف من التخزين: " + storageError.message, true);
      }
    }
    await loadContent();
    say("تم حذف المحتوى وسجلّه من المكتبة.");
  }
  function download(name, type, text) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function csvCell(value) { return '"' + String(value ?? "").replace(/"/g, '""') + '"'; }
  $("#search")?.addEventListener("input", render);
  $("#filter-course")?.addEventListener("change", render);
  $("#export")?.addEventListener("click", () => {
    const data = [["العنوان", "النوع", "الدورة", "الوصف", "حالة النشر", "مسار الملف", "تاريخ الإنشاء"], ...rows.map(row => [row.title, row.content_type, row.course_slug === "tasees" ? "تأسيس" : "تدريبات", row.description, row.is_published ? "منشور" : "مسودة", row.storage_path, row.created_at])];
    download("athar-content.csv", "text/csv;charset=utf-8", "\uFEFF" + data.map(row => row.map(csvCell).join(",")).join("\r\n"));
    say("تم تجهيز ملف CSV للمحتوى المحمّل.");
  });
  function exportJson() {
    download("athar-content-backup.json", "application/json;charset=utf-8", JSON.stringify({ exportedAt: new Date().toISOString(), itemCount: rows.length, items: rows }, null, 2));
    say("تم تنزيل النسخة الاحتياطية الوصفية. الملفات نفسها لم تُنسخ.");
  }
  $("#backup-json")?.addEventListener("click", exportJson);
  $("#backup-all-json")?.addEventListener("click", exportJson);
  start().catch(error => say("تعذر تهيئة لوحة الإدارة: " + error.message, true));
})();