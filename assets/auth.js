(() => {
  const form = document.querySelector("#sign-in-form");
  const message = document.querySelector("#auth-message");
  if (!form || !message) return;
  const config = window.ATHAR_SUPABASE_CONFIG || {};
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim();
    const button = form.querySelector("button");
    if (!config.url || !config.publishableKey) {
      message.textContent = "لم يتم ربط Supabase بعد. أضف رابط المشروع وpublishable key في assets/supabase-config.js أولاً.";
      return;
    }
    if (!window.supabase?.createClient) {
      message.textContent = "تعذر تحميل مكتبة تسجيل الدخول. تحقق من اتصال الإنترنت ثم أعد المحاولة.";
      return;
    }
    button.disabled = true;
    message.textContent = "جارٍ إرسال رابط الدخول…";
    try {
      const client = window.supabase.createClient(config.url, config.publishableKey);
      const requested = new URLSearchParams(window.location.search).get("next") || "index.html";
      const safeNext = /^(index|admin|courses|practice|exam|resources|study-plan|mcq-builder)\.html$/.test(requested) ? requested : "index.html";
      const redirectUrl = new URL(safeNext, window.location.href).toString();
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl, shouldCreateUser: false } });
      if (error) throw error;
      message.textContent = "إذا كان البريد مسجلاً ومصرحاً له، ستصلك رسالة دخول آمنة. لا يوجد تسجيل عام في لوحة الإدارة.";
    } catch (error) {
      message.textContent = error?.message || "تعذر إرسال رسالة الدخول. تحقق من إعدادات البريد في Supabase.";
    } finally { button.disabled = false; }
  });
})();