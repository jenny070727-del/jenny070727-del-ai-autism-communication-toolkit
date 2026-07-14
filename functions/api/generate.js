const SYSTEM_PROMPT = `
You help adults create preliminary visual support materials for autistic children.
You are not a clinician, therapist, or diagnostic tool.
Do not diagnose, treat, infer hidden intention, explain behavior causes, or claim treatment effects.
Create clear, simple, low-pressure support materials based on established practices: visual schedules, step-by-step routines, social stories, AAC-inspired communication cards, and communication partner guidance.
Always preserve autonomy: include help, break, stop, no, I don't understand, please say it again, too loud, and you misunderstood me.
Return only valid JSON.`;

const REQUIRED_CARDS = ["我需要帮助","我需要休息","我没听懂","请再说一次","停止","不要","太吵了","你理解错了"];

export async function onRequestGet(context) {
  const provider = chooseProvider(context.env, null, context.request.headers);
  return json({ ok: true, provider_configured: Boolean(provider), provider: provider?.name || null, source: provider?.source || null });
}

export async function onRequestPost(context) {
  try {
    const input = await context.request.json();
    const mode = String(input.mode || "visual").trim().toLowerCase();
    const scenario = String(input.scenario || input.text || input.original_text || "").trim();
    if (!scenario) return json({ error: "Missing input text." }, 400);
    const provider = chooseProvider(context.env, input.client_api, context.request.headers);
    if (!provider) return json({ error: "AI API is not configured." }, 501);
    if (mode === "partner") {
      const raw = provider.name === "openai" ? await callOpenAI(buildPartnerPrompt(input), provider) : await callDeepSeek(buildPartnerPrompt(input), provider);
      return json(normalizePartner(safeParseJson(raw), provider, scenario));
    }
    const prompt = buildPrompt(input);
    const raw = provider.name === "openai" ? await callOpenAI(prompt, provider) : await callDeepSeek(prompt, provider);
    const pkg = normalize(safeParseJson(raw), provider);
    return json(pkg);
  } catch (error) {
    return json({ error: "Generation failed.", detail: error.message || String(error) }, 500);
  }
}

function chooseProvider(env, clientApi, headers) {
  const clientProvider = String(clientApi?.provider || headers?.get?.("x-client-provider") || "").toLowerCase();
  const clientKey = String(clientApi?.api_key || headers?.get?.("x-client-api-key") || "").trim();
  const clientModel = String(clientApi?.model || headers?.get?.("x-client-model") || "").trim();
  if (clientKey && ["openai","deepseek"].includes(clientProvider)) return { name: clientProvider, apiKey: clientKey, model: clientModel, source: "client" };
  const explicit = String(env.AI_PROVIDER || "").toLowerCase();
  if (explicit === "openai" && env.OPENAI_API_KEY) return { name: "openai", apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, source: "env" };
  if (explicit === "deepseek" && env.DEEPSEEK_API_KEY) return { name: "deepseek", apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL, source: "env" };
  if (env.OPENAI_API_KEY) return { name: "openai", apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, source: "env" };
  if (env.DEEPSEEK_API_KEY) return { name: "deepseek", apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL, source: "env" };
  return null;
}

function buildPrompt(input) {
  return `请根据以下场景生成中文视觉支持包。
场景：${input.scenario}
儿童沟通情况：${input.communication_context || "不确定"}
目标：${input.goal || "提前解释接下来会发生什么"}
地点：${input.setting || "其他"}

必须返回 JSON：
{
  "title": "短标题",
  "summary": "一句成人说明",
  "visual_schedule": [{"step":1,"title":"步骤标题","child_sentence":"儿童可读短句","icon_suggestion":"emoji","adult_note":"成人提示"}],
  "social_story": ["5到7句简单中文"],
  "communication_cards": [{"label":"卡片文字","purpose":"用途","icon_suggestion":"emoji"}],
  "adult_guidance": ["3到6条成人提示"],
  "safety_note": "安全提醒"
}
规则：5-8个步骤；必须包含这些沟通卡：${REQUIRED_CARDS.join("、")}；不要诊断、不要解释行为原因、不要推断隐藏意图。`;
}

function buildPartnerPrompt(input) {
  return `请把成人对孩子说的话改写成更短、更具体、低压力的中文表达。
成人原话：${input.text || input.original_text || input.scenario}

必须返回 JSON：
{
  "original": "成人原话",
  "rewritten_steps": ["3到6个短句，每句只包含一个具体动作或一个明确选择"],
  "guidance": ["2到4条改写原则"],
  "safety_note": "安全提醒"
}
规则：
- 只做语言复杂度降低，不做医疗建议、行为分析、诊断或意图推断。
- 不要声称这样能治疗或纠正自闭症。
- 不要加入惩罚、威胁、羞辱、强迫眼神接触、逼问原因等内容。
- 优先去掉“赶紧、快点、不然、你怎么还不、表现好一点”等压力表达。
- 输出应帮助沟通伙伴说得更清楚，而不是让孩子更听话。`;
}

async function callOpenAI(prompt, provider) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model || "gpt-4.1-mini", input: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }], text: { format: { type: "json_object" } } })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `OpenAI error ${response.status}`);
  return data.output_text || (data.output || []).flatMap(x => x.content || []).map(x => x.text || "").join("\n");
}

async function callDeepSeek(prompt, provider) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model || "deepseek-chat", messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.3 })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `DeepSeek error ${response.status}`);
  return data.choices?.[0]?.message?.content || "";
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model output was not JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizePartner(pkg, provider, original) {
  const steps = Array.isArray(pkg.rewritten_steps) ? pkg.rewritten_steps : [];
  return {
    provider: provider.name,
    source: provider.source,
    mode: "partner",
    original: pkg.original || original,
    rewritten_steps: steps.slice(0, 6),
    guidance: Array.isArray(pkg.guidance) ? pkg.guidance.slice(0, 4) : ["一次只说一个步骤。", "用具体动作代替抽象要求。"],
    safety_note: pkg.safety_note || "这是沟通材料草稿，不是医疗或治疗建议，需要成人和专业人员确认后使用。"
  };
}

function normalize(pkg, provider) {
  const cards = Array.isArray(pkg.communication_cards) ? pkg.communication_cards : [];
  const labels = new Set(cards.map(c => String(c.label || "")));
  for (const label of REQUIRED_CARDS) if (!labels.has(label)) cards.push({ label, purpose: "帮助孩子表达需求、边界或澄清误解", icon_suggestion: icon(label) });
  return {
    provider: provider.name, source: provider.source,
    title: pkg.title || "AI 生成视觉支持包",
    summary: pkg.summary || "这是一份供成人和专业人员审阅的视觉支持材料草稿。",
    visual_schedule: Array.isArray(pkg.visual_schedule) ? pkg.visual_schedule.slice(0, 8) : [],
    social_story: Array.isArray(pkg.social_story) ? pkg.social_story.slice(0, 8) : [],
    communication_cards: cards.slice(0, 12),
    adult_guidance: Array.isArray(pkg.adult_guidance) ? pkg.adult_guidance.slice(0, 8) : [],
    safety_note: pkg.safety_note || "AI 生成内容只是草稿，需要成人和专业人员确认后再使用。"
  };
}

function icon(label) {
  if (label.includes("帮助")) return "🙋";
  if (label.includes("休息")) return "🧘";
  if (label.includes("没听懂")) return "❓";
  if (label.includes("再说")) return "🔁";
  if (label.includes("停止")) return "✋";
  if (label.includes("不要")) return "🚫";
  if (label.includes("太吵")) return "🔇";
  if (label.includes("理解错")) return "💬";
  return "🧩";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
