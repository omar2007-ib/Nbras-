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

  // This value identifies the owner-login route only. It is NOT an authentication credential.
  // The admin page must still verify the authenticated user's role in Supabase.
  const OWNER_QR_CODE = "ATHAR-OWNER-QR-2026";
  const isOwnerQrValue = value => {
    if (value === OWNER_QR_CODE) return true;
    try {
      const parsed = new URL(value, location.href);
      return parsed.origin === location.origin &&
        parsed.pathname.endsWith("/auth.html") &&
        parsed.searchParams.get("owner_qr") === OWNER_QR_CODE;
    } catch (_) { return false; }
  };
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

  // Replace the previous, broken QR generator (which referenced missing elements)
  // with a QR that opens the owner sign-in route, never the admin page directly.
  function renderOwnerQr() {
    const box = document.querySelector("#owner-qr-code");
    const status = document.querySelector("#owner-qr-status");
    if (!box || !status) return;
    const target = new URL("auth.html?owner_qr=" + encodeURIComponent(OWNER_QR_CODE), location.href).toString();
    if (typeof window.QRCode === "undefined") {
      status.textContent = "تعذر تحميل مولّد QR. أعد تحميل الصفحة بعد التحقق من الاتصال.";
      return;
    }
    try {
      box.replaceChildren();
      new window.QRCode(box, { text: target, width: 144, height: 144, colorDark: "#16324F", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M });
      status.textContent = "تم إنشاء رمز QR لصفحة دخول المالك.";
    } catch (_) {
      status.textContent = "تعذر إنشاء رمز QR. أعد تحميل الصفحة.";
    }
  }
  window.addEventListener("load", renderOwnerQr);
  if (document.readyState === "complete") renderOwnerQr();

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
      const result = await client().auth.signInWithOAuth({ provider, options: { redirectTo: callback } });
      if (result.error) throw result.error;
    } catch (_) {
      say(provider === "google" ? "تعذر بدء دخول Google. تأكد من تفعيل Google في Supabase وضبط Client ID وSecret وعنوان الرجوع." : "تعذر بدء دخول Apple. تأكد من تفعيل Apple في Supabase وضبط Services ID والمفاتيح وعنوان الرجوع.", true);
      button.disabled = false;
      button.textContent = old;
    }
  }

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
      const result = await client().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect(), shouldCreateUser: false } });
      if (result.error) throw result.error;
      say("إذا كان البريد مسجّلًا ومصرّحًا له، فستصلك رسالة دخول. لن يُنشأ حساب جديد.");
    } catch (_) {
      say("تعذر إرسال رابط الدخول. تحقق من إعدادات المصادقة والبريد في Supabase.", true);
    } finally {
      emailButton.disabled = false;
      emailButton.textContent = old;
    }
  });

  // Camera-based QR scanning. Prefer the browser's native BarcodeDetector; use jsQR as fallback.
  const video = document.querySelector("#qr-camera");
  const canvas = document.querySelector("#qr-canvas");
  const scanStatus = document.querySelector("#qr-scan-status");
  const startScanButton = document.querySelector("#start-qr-scan");
  const stopScanButton = document.querySelector("#stop-qr-scan");
  let cameraStream = null;
  let scanFrame = null;
  let scanning = false;
  let detector = null;
  const stopScanner = () => {
    scanning = false;
    if (scanFrame !== null) cancelAnimationFrame(scanFrame);
    scanFrame = null;
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    if (video) { video.pause(); video.srcObject = null; video.hidden = true; }
    if (startScanButton) startScanButton.disabled = false;
    if (stopScanButton) stopScanButton.disabled = true;
  };
  const handleQrValue = value => {
    stopScanner();
    if (isOwnerQrValue(value)) {
      scanStatus.textContent = "تم التعرف على رمز مالك أثَر. جارٍ فتح صفحة تسجيل الدخول…";
      const url = new URL("auth.html?owner_qr=" + encodeURIComponent(OWNER_QR_CODE), location.href);
      window.location.assign(url.toString());
      return;
    }
    scanStatus.textContent = "هذا الرمز غير معتمد لدخول مالك أثَر. لم يتم فتح أي رابط.";
  };
  const scanLoop = async () => {
    if (!scanning || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (scanning) scanFrame = requestAnimationFrame(scanLoop);
      return;
    }
    try {
      if (detector) {
        const codes = await detector.detect(video);
        if (codes.length && codes[0].rawValue) return handleQrValue(codes[0].rawValue);
      } else if (window.jsQR && canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = window.jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
        if (result?.data) return handleQrValue(result.data);
      } else {
        scanStatus.textContent = "ماسح QR غير متاح في هذا المتصفح. حدّث الصفحة أو استخدم متصفحًا يدعم BarcodeDetector.";
        stopScanner();
        return;
      }
    } catch (_) {
      // If the native detector fails at runtime, fall back to jsQR instead of retrying it forever.
      if (detector && window.jsQR) detector = null;
      /* Continue scanning; transient frame decode errors are expected. */
    }
    scanFrame = requestAnimationFrame(scanLoop);
  };
  startScanButton?.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      scanStatus.textContent = "الكاميرا غير متاحة. افتح الموقع عبر HTTPS واستخدم متصفحًا يدعم الكاميرا.";
      return;
    }
    startScanButton.disabled = true;
    scanStatus.textContent = "جارٍ طلب إذن الكاميرا…";
    try {
      if ("BarcodeDetector" in window) {
        try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (_) { detector = null; }
      }
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      video.srcObject = cameraStream;
      video.hidden = false;
      await video.play();
      scanning = true;
      stopScanButton.disabled = false;
      scanStatus.textContent = "وجّه الكاميرا إلى رمز QR الخاص بأثَر.";
      scanLoop();
    } catch (_) {
      stopScanner();
      scanStatus.textContent = "تعذر تشغيل الكاميرا. اسمح بإذن الكاميرا وتأكد من فتح الموقع عبر HTTPS.";
    }
  });
  stopScanButton?.addEventListener("click", () => {
    stopScanner();
    scanStatus.textContent = "تم إيقاف الكاميرا.";
  });
  window.addEventListener("pagehide", stopScanner);
})();