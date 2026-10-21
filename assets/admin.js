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
      const publish = document.createElement("button");
      publish.type = "button"; publish.className = "btn small-btn";
      publish.textContent = row.is_published ? "إلغاء النشر" : "نشر";
      publish.addEventListener("click", () => setPublished(row, !row.is_published));
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn small-btn"; del.style.marginInlineStart = "6px";
      del.textContent = "حذف"; del.addEventListener("click", () => removeRow(row));
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
    if (!title) return say("اكتب عنوان المحتوى أولاً.", true);
    if (!files.length && kind !== "link") return say("اختر ملفاً أو أكثر لرفعه. الروابط الخارجية ستُضاف في خطوة لاحقة.", true);
    if (files.some(file => file.size > MAX_FILE_SIZE)) return say("حجم كل ملف يجب ألا يتجاوز 50 ميجابايت في إعداد التخزين الحالي.", true);
    if (files.some(file => !allowedFile(file, kind))) return say("نوع ملف غير مسموح لهذا النوع من المحتوى. المسموح: PDF والصور المعتمدة والفيديو MP4/WebM.", true);
    submit.disabled = true;
    try {
      if (!files.length) throw new Error("لا يوجد ملف محدد.");
      let uploaded = 0;
      for (const [index, file] of files.entries()) {
        const safeName = file.name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-100) || "file";
        const path = course + "/" + user.id + "/" + crypto.randomUUID() + "-" + safeName;
        const { error: uploadError } = await client.storage.from("athar-content").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream"
        });
        if (uploadError) throw uploadError;
        const contentType = kind === "video" ? "video" : kind === "pdf" ? "pdf" : kind === "worksheet" ? "worksheet" : "lesson";
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
        say("تم رفع " + uploaded + " من " + files.length + " ملف…");
      }
      form.reset();
      await loadContent();
      say("اكتمل رفع " + uploaded + " ملف إلى التخزين الخاص وربطه بقاعدة البيانات.");
    } catch (error) {
      say("تعذر إكمال الرفع: " + (error?.message || "خطأ غير معروف"), true);
    } finally { submit.disabled = false; }
  }
  function allowedFile(file, kind) {
    const allowed = kind === "video" ? MIME.video : kind === "pdf" ? MIME.pdf : kind === "worksheet" ? MIME.worksheet : [...MIME.pdf, ...MIME.video, ...MIME.image];
    return allowed.includes(file.type);
  }
  async function setPublished(row, value) {
    const { error } = await client.from("course_content").update({ is_published: value, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) return say("تعذر تحديث حالة النشر: " + error.message, true);
    await loadContent();
  }
  async function removeRow(row) {
    if (!confirm("هل تريد حذف هذا المحتوى؟ لا يمكن التراجع عن الحذف.")) return;
    if (row.storage_path) {
      const { error } = await client.storage.from("athar-content").remove([row.storage_path]);
      if (error) return say("تعذر حذف الملف من التخزين: " + error.message, true);
    }
    const { error } = await client.from("course_content").delete().eq("id", row.id);
    if (error) return say("تعذر حذف سجل المحتوى: " + error.message, true);
    await loadContent();
    say("تم حذف المحتوى.");
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