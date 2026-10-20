import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "استخدم POST فقط." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const aiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return reply({ error: "إعدادات Supabase غير مكتملة." }, 500);
  if (!aiKey) return reply({ error: "مولّد الذكاء الاصطناعي لم يُفعّل بعد. يحتاج المالك إلى إضافة OPENAI_API_KEY كسرّ في إعدادات Edge Functions." }, 503);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "سجّل الدخول بحساب المالك أو المدير أولاً." }, 401);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return reply({ error: "جلسة الدخول غير صالحة. سجّل الدخول مجددًا." }, 401);
  const user = await userResponse.json();
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!profileResponse.ok) return reply({ error: "تعذّر التحقق من الصلاحيات." }, 403);
  const profiles = await profileResponse.json();
  if (!profiles?.[0] || !["owner", "admin"].includes(profiles[0].role)) {
    return reply({ error: "هذه الأداة متاحة للمالك والمدير فقط." }, 403);
  }

  let body: { text?: string; count?: number; category?: string; difficulty?: string; mode?: string };
  try { body = await req.json(); } catch { return reply({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const sourceText = String(body.text || "").trim();
  const count = Math.max(1, Math.min(30, Math.floor(Number(body.count) || 5)));
  const category = ["كمي", "لفظي", "عام"].includes(String(body.category)) ? String(body.category) : "كمي";
  const difficulty = ["سهل", "متوسط", "صعب", "متدرج"].includes(String(body.difficulty)) ? String(body.difficulty) : "متوسط";
  if (sourceText.length < 80) return reply({ error: "أضف نصًا أطول (80 حرفًا على الأقل) أو ارفع PDF يحتوي على نص قابل للاستخراج." }, 400);
  if (sourceText.length > 30000) return reply({ error: "النص طويل جدًا. اختصره إلى 30 ألف حرف أو أقل." }, 413);

  const systemPrompt = `أنت مساعد خبير في إعداد أسئلة تدريبية عربية لاختبار القدرات السعودي. أنشئ أسئلة اختيار من متعدد دقيقة، ولا تختلق معلومات خارج المصدر عندما يكون وضع المصدر مطلوبًا. أعد JSON فقط بهذا الشكل: {"questions":[{"question":"...","options":["...","...","...","..."],"correct":0,"category":"كمي","difficulty":"متوسط","explanation":"..."}]}. correct فهرس من 0 إلى 3. اجعل الخيارات مختلفة ومعقولة، وإجابة واحدة صحيحة فقط. في الأسئلة الحسابية تحقق من الحل حسابيًا واشرح خطواته. لا تنسخ فقرات المصدر حرفيًا؛ أنشئ صياغات تدريبية جديدة.`;
  const mode = body.mode === "extract" ? "استخرج الأسئلة الموجودة فعلًا في المصدر وأعد صياغتها بأمانة عند الحاجة، ولا تخترع سؤالًا غير موجود." : "أنشئ أسئلة جديدة مستندة إلى المفاهيم والمهارات الموجودة في المصدر، وليست مجرد نسخ حرفي.";
  const userPrompt = `المطلوب: ${count} سؤالًا. القسم: ${category}. الصعوبة: ${difficulty}. المهمة: ${mode}\n\nالمصدر:\n${sourceText}`;
  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!aiResponse.ok) {
    const details = await aiResponse.text();
    console.error("AI provider error", aiResponse.status, details.slice(0, 500));
    return reply({ error: "تعذّر توليد الأسئلة من مزوّد الذكاء الاصطناعي. تحقق من المفتاح والرصيد وإعدادات النموذج." }, 502);
  }
  const completion = await aiResponse.json();
  let parsed: any;
  try { parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}"); }
  catch { return reply({ error: "لم يُرجع النموذج صيغة أسئلة قابلة للقراءة. أعد المحاولة." }, 502); }
  const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, count) : [];
  const valid = questions.filter((q: any) =>
    typeof q.question === "string" && q.question.trim() &&
    Array.isArray(q.options) && q.options.length === 4 && q.options.every((v: unknown) => typeof v === "string" && v.trim()) &&
    Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4
  ).map((q: any) => ({
    question: q.question.trim(),
    options: q.options.map((v: string) => v.trim()),
    correct: q.correct,
    category,
    difficulty: ["سهل", "متوسط", "صعب"].includes(q.difficulty) ? q.difficulty : (difficulty === "متدرج" ? "متوسط" : difficulty),
    explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
  }));
  if (!valid.length) return reply({ error: "لم ينتج النموذج أسئلة صحيحة. جرّب مصدرًا أوضح." }, 502);
  return reply({ questions: valid, generated: valid.length, reviewRequired: true });
});
