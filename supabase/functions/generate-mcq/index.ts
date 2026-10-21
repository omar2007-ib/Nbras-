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
  // OpenAI-compatible gateway: configure a provider from the free-LLM directory.
  // Provider API keys stay server-side and are never shipped to the browser.
  const aiKey = Deno.env.get("LLM_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  const hasLegacyOpenAI = Boolean(Deno.env.get("OPENAI_API_KEY")) && !Deno.env.get("LLM_API_KEY");
  const baseUrl = (Deno.env.get("LLM_BASE_URL") || (hasLegacyOpenAI ? "https://api.openai.com/v1" : "https://openrouter.ai/api/v1")).replace(/\/+$/, "");
  const model = Deno.env.get("LLM_MODEL") || Deno.env.get("OPENAI_MODEL") || (hasLegacyOpenAI ? "gpt-4o-mini" : "openai/gpt-oss-20b:free");
  const providerName = Deno.env.get("LLM_PROVIDER") || (hasLegacyOpenAI ? "OpenAI" : "OpenRouter");
  if (!supabaseUrl || !anonKey) return reply({ error: "إعدادات Supabase غير مكتملة." }, 500);
  if (!aiKey) return reply({ error: "بوابة نماذج اللغة غير مفعّلة. أضف LLM_API_KEY وLLM_BASE_URL وLLM_MODEL في أسرار Supabase، أو استخدم إعدادات OpenAI القديمة. راجع docs/implementation/llm-provider-gateway.md." }, 503);

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
  const endpoint = baseUrl + "/chat/completions";
  const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];
  const requestBody = { model, temperature: 0.25, response_format: { type: "json_object" }, messages };
  let aiResponse = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  // Some OpenAI-compatible providers/models do not implement JSON mode. Retry only
  // on request-shape errors, without weakening authentication or response validation.
  if (!aiResponse.ok && [400, 422].includes(aiResponse.status)) {
    aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.25, messages }),
    });
  }
  if (!aiResponse.ok) {
    const details = await aiResponse.text();
    console.error("LLM gateway error", providerName, aiResponse.status, details.slice(0, 500));
    return reply({ error: "تعذّر التوليد من " + providerName + ". تحقق من عنوان API والمفتاح والنموذج وحدود الاستخدام لدى المزوّد." }, 502);
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
