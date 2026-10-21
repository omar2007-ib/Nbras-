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
  const client = () => {
    if (!config.url || !config.publishableKey) throw new Error("خدمة تسجيل الدخول غير مربوطة حاليًا.");
    if (!window.supabase?.createClient) throw new Error("تعذر تحميل خدمة تسجيل الدخول. تحقق من اتصال الإنترنت.");
    return window.supabase.createClient(config.url, config.publishableKey);
  };
  const redirect = () => {
    const requested = new URLSearchParams(location.search).get("next") || "index.html";
    const safe = /^(index|admin|courses|practice|exam|resources|study-plan|mcq-builder)\.html$/.test(requested) ? requested : "index.html";
    return new URL(safe, location.href).toString();
  };
  async function oauth(provider, button) {
    const old = button.textContent;
    button.disabled = true;
    say("جارٍ فتح تسجيل الدخول الآمن…");
    try {
      const result = await client().auth.signInWithOAuth({provider, options:{redirectTo:redirect()}});
      if (result.error) throw result.error;
    } catch (_) {
      say("تعذر بدء تسجيل الدخول. قد يحتاج مزوّد الخدمة إلى التفعيل من إعدادات Supabase.", true);
      button.disabled = false;
      button.textContent = old;
    }
  }
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
      const result = await client().auth.signInWithOtp({email, options:{emailRedirectTo:redirect(), shouldCreateUser:false}});
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