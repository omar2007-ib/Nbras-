(() => {
  "use strict";
  const form = document.querySelector("#sign-in-form");
  const message = document.querySelector("#auth-message");
  if (!form || !message) return;
  const config = window.ATHAR_SUPABASE_CONFIG || {};
  const emailInput = document.querySelector("#email");
  const emailButton = form.querySelector('button[type="submit"]');
  const say = (text, error = false) => {
    message.textContent = text;
    message.style.color = error ? "#9b2c2c" : "#16324f";
  };
  let supabaseClient;
  const client = () => {
    if (!config.url || !config.publishableKey) throw new Error("خدمة تسجيل الدخول غير مربوطة حاليًا.");
    if (!window.supabase?.createClient) throw new Error("تعذر تحميل خدمة تسجيل الدخول. تحقق من اتصال الإنترنت.");
    if (!supabaseClient) supabaseClient = window.supabase.createClient(config.url, config.publishableKey);
    return supabaseClient;
  };
  const OWNER_QR_CODE = "ATHAR-OWNER-QR-2026";
  const isOwnerQr = new URLSearchParams(location.search).get("owner_qr") === OWNER_QR_CODE;
  if (isOwnerQr) {
    const ownerPanel = document.querySelector("#owner-qr-recognition");
    if (ownerPanel) ownerPanel.hidden = false;
    document.title = "دخول المالك | أثَر";
    const pageTitle = document.querySelector("#page-title");
    if (pageTitle) pageTitle.textContent = "دخول المالك";
    const intro = document.querySelector(".intro");
    if (intro) intro.textContent = "تم التعرّف على رمز QR الخاص بالمالك. سجّل الدخول بالحساب المعتمد لإكمال التحقق.";
  }
  const redirect = () => {
    const params = new URLSearchParams(location.search);
    const requested = params.get("next") || (isOwnerQr || params.get("owner") === "1" ? "admin.html" : "index.html");
    const safe = /^(index|admin|courses|practice|exam|resources|study-plan|mcq-builder)\.html$/.test(requested) ? requested : "index.html";
    return new URL(safe, location.href).toString();
  };
  async function oauth(provider, button) {
    const old = button.textContent;
    button.disabled = true;
    say("جارٍ فتح تسجيل الدخول الآمن…");
    try {
      const callback = new URL("auth.html?next=admin.html", location.href).toString();
      const result = await client().auth.signInWithOAuth({provider, options:{redirectTo:callback}});
      if (result.error) throw result.error;
    } catch (_) {
      say(provider === "google" ? "تعذر بدء دخول Google. تأكد من تفعيل Google في Supabase وضبط Client ID وSecret وعنوان الرجوع." : "تعذر بدء دخول Apple. تأكد من تفعيل Apple في Supabase وضبط Services ID والمفاتيح وعنوان الرجوع.", true);
      button.disabled = false;
      button.textContent = old;
    }
  }

  // Complete OAuth/magic-link callbacks on this page before forwarding to the requested destination.
  (async function finishAuthCallback() {
    const params = new URLSearchParams(location.search);
    const hasCallback = params.has("code") || params.has("error") || /(?:^|[&#])access_token=/.test(location.hash);
    if (params.has("error")) {
      say("تعذر إكمال تسجيل الدخول: " + (params.get("error_description") || params.get("error")), true);
      return;
    }
    if (!hasCallback) return;
    try {
      const { data, error } = await client().auth.getSession();
      if (error) throw error;
      if (data?.session?.user) {
        say("تم التحقق من الجلسة. جارٍ فتح لوحة الإدارة…");
        window.location.replace(redirect());
      } else {
        say("لم تكتمل جلسة الدخول. أعد المحاولة وتأكد من إعداد عنوان الرجوع في Supabase.", true);
      }
    } catch (_) {
      say("تعذر إكمال جلسة الدخول. تحقق من إعدادات OAuth وعناوين الرجوع في Supabase.", true);
    }
  })();

  document.querySelector("#google-sign-in")?.addEventListener("click", e => oauth("google", e.currentTarget));
  document.querySelector("#apple-sign-in")?.addEventListener("click", e => oauth("apple", e.currentTarget));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = emailInput?.value.trim();
    if (!email) { say("اكتب البريد الإلكتروني أولًا.", true); emailInput?.focus(); return; }
    const old = emailButton.textContent;
    emailButton.disabled = true;
    say("جارٍ إرسال رابط الدخول…");
    try {
      const result = await client().auth.signInWithOtp({email, options:{emailRedirectTo:redirect(), shouldCreateUser: false}});
      if (result.error) throw result.error;
      say("إذا كان البريد مسجّلًا ومصرّحًا له، فستصلك رسالة دخول. لن يُنشأ حساب جديد.");
    } catch (_) {
      say("تعذر إرسال رابط الدخول. تحقق من إعدادات المصادقة والبريد في Supabase.", true);
    } finally {
      emailButton.disabled = false;
      emailButton.textContent = old;
    }
  });
})();