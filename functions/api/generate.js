const SYSTEM_PROMPT = `
You help adults create preliminary visual support materials for autistic children.
You are not a clinician, therapist, or diagnostic tool.
Do not diagnose, treat, infer hidden intention, explain behavior causes, or claim treatment effects.
Create clear, simple, low-pressure support materials based on established practices: visual schedules, First-Then supports, social narratives, AAC/core vocabulary, functional communication, aided language modeling, and communication partner guidance.
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
    if (mode === "aac") {
      const raw = provider.name === "openai" ? await callOpenAI(buildAACPrompt(input), provider) : await callDeepSeek(buildAACPrompt(input), provider);
      return json(normalizeAAC(safeParseJson(raw), provider, scenario, input));
    }
    if (mode === "partner") {
      const raw = provider.name === "openai" ? await callOpenAI(buildPartnerPrompt(input), provider) : await callDeepSeek(buildPartnerPrompt(input), provider);
      return json(normalizePartner(safeParseJson(raw), provider, scenario, input));
    }
    const prompt = buildPrompt(input);
    const raw = provider.name === "openai" ? await callOpenAI(prompt, provider) : await callDeepSeek(prompt, provider);
    const pkg = normalize(safeParseJson(raw), provider, input);
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
  return `请根据以下场景生成中文视觉流程支持材料。
场景：${input.scenario}
当前沟通方式：${input.communication_context || modeLabel(input.communication_mode)}
目标：${input.goal || "提前解释接下来会发生什么"}
地点：${input.setting || "其他"}

必须返回 JSON：
{
  "title": "短标题",
  "summary": "一句成人说明",
  "visual_schedule": [{"step":1,"title":"步骤标题","child_sentence":"儿童可读短句","icon_suggestion":"emoji","adult_note":"成人提示"}],
  "first_then": {"first":"先做什么","then":"后做什么"},
  "social_story": ["5到7句简单中文"],
  "card_suggestions": ["建议搭配模块2的表达卡名称"],
  "adult_guidance": ["3到6条成人提示"],
  "safety_note": "安全提醒"
}
规则：5-8个视觉步骤；模块1只负责视觉日程表、First-Then和社交叙事，不直接生成完整AAC卡组；card_suggestions只列出建议去模块2搭配的表达卡名称；不要诊断、不要解释行为原因、不要推断隐藏意图。
当前沟通方式不是诊断分类，只用于调整输出形式：
- 不确定：生成保守版本；
- 图片+短句：保留图标和简短文字；
- 指点/手势：减少步骤和文字，强调成人接受非口语选择；
- 有口语但紧张时需要备用表达：加入备用表达建议。`;
}

function buildAACPrompt(input) {
  return `请根据以下真实场景生成中文 AAC / 图片表达系统。
场景：${input.text || input.scenario || input.original_text}
当前沟通方式：${input.communication_context || modeLabel(input.communication_mode)}

必须返回 JSON：
{
  "title": "短标题",
  "core_cards": [{"label":"核心卡文字","purpose":"用途","icon_suggestion":"emoji"}],
  "scenario_cards": [{"label":"场景卡文字","purpose":"用途","icon_suggestion":"emoji"}],
  "function_cards": [{"label":"功能表达卡文字","purpose":"用途","icon_suggestion":"emoji"}],
  "communication_cards": [{"label":"卡片文字","purpose":"用途","icon_suggestion":"emoji"}],
  "adult_guidance": ["2到4条成人使用提示"],
  "safety_note": "安全提醒"
}
规则：
- 生成三类卡片：固定核心卡、当前场景卡、功能表达卡。
- core_cards 必须包含：我需要帮助、我需要休息、我没听懂、请再说一次、停止、不要、太吵了、你理解错了。
- scenario_cards 根据具体场景生成物品、地点、活动、人物或感官相关词。
- function_cards 支持请求、拒绝、澄清、修复误解、选择、等待。
- communication_cards 可以是三类卡片的合并版本，方便旧前端兼容。
- 卡片是表达选项，不代表孩子一定有这些想法。
- 当前沟通方式不是诊断分类，只用于调整卡片数量、文字量、呈现方式和备用表达：
  - 不确定：保留核心权利表达，生成保守数量；
  - 图片+短句：图标 + 简短文字；
  - 指点/手势：更少、更大、更具体的选择，保留停止/休息/帮助/没懂；
  - 口语紧张不稳定：增加“我现在说不出来”“请等一下”“我想用卡片说”“我想打字”等备用表达。
- 不要诊断，不要解释行为原因，不要推断隐藏意图，不要做治疗建议。
- 重点支持孩子表达需求、边界、拒绝、澄清和请求重复。`;
}

function buildPartnerPrompt(input) {
  return `请把成人对孩子说的话改写成更短、更具体、低压力的中文表达。
成人原话：${input.text || input.original_text || input.scenario}
当前沟通方式：${input.communication_context || modeLabel(input.communication_mode)}

必须返回 JSON：
{
  "original": "成人原话",
  "rewritten_steps": ["3到6个短句，每句只包含一个具体动作或一个明确选择"],
  "modeling_script": ["成人怎么一边说短句、一边指向或示范使用表达卡"],
  "guidance": ["2到4条改写原则"],
  "safety_note": "安全提醒"
}
规则：
- 只做语言复杂度降低，不做医疗建议、行为分析、诊断或意图推断。
- 不要声称这样能治疗或纠正自闭症。
- 不要加入惩罚、威胁、羞辱、强迫眼神接触、逼问原因等内容。
- 优先去掉“赶紧、快点、不然、你怎么还不、表现好一点”等压力表达。
- modeling_script 使用 Aided Language Modeling 思路：成人说一句短句，同时示范可点选的表达卡，例如“我没听懂”“我想休息”“请再说一次”。
- 当前沟通方式不是诊断分类，只用于调整沟通伙伴支持方式：
  - 指点/手势：加入“成人依次指卡片、等待孩子用指/点/手势选择”的脚本；
  - 口语紧张不稳定：加入“可以用卡片、文字或打字替代口语”的脚本；
  - 不确定：使用保守、低压力、少量选择的脚本。
- 输出应帮助沟通伙伴说得更清楚并示范表达方式，而不是让孩子更听话。`;
}

function modeLabel(mode) {
  return ({
    conservative: "不确定，先生成保守版本",
    picture_text: "能理解图片 + 简短文字",
    gesture_choice: "主要通过指、点、手势选择",
    speech_backup: "有口语，但紧张时需要备用表达"
  })[String(mode || "conservative")] || "不确定，先生成保守版本";
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

function normalizeAAC(pkg, provider, original, input = {}) {
  const coreCards = Array.isArray(pkg.core_cards) ? [...pkg.core_cards] : [];
  const scenarioCards = Array.isArray(pkg.scenario_cards) ? [...pkg.scenario_cards] : [];
  const functionCards = Array.isArray(pkg.function_cards) ? [...pkg.function_cards] : [];
  const coreLabels = new Set(coreCards.map(c => String(c.label || "")));
  for (const label of REQUIRED_CARDS) {
    if (!coreLabels.has(label)) coreCards.push({ label, purpose: "跨场景核心表达，帮助孩子表达需求、边界或澄清误解", icon_suggestion: icon(label) });
  }
  const cards = [...coreCards, ...scenarioCards, ...functionCards];
  return {
    provider: provider.name,
    source: provider.source,
    mode: "aac",
    title: pkg.title || "AAC 沟通卡",
    original,
    communication_mode_label: modeLabel(input.communication_mode),
    core_cards: coreCards.slice(0, 10),
    scenario_cards: scenarioCards.slice(0, 8),
    function_cards: functionCards.slice(0, 8),
    communication_cards: cards.slice(0, 12),
    adult_guidance: Array.isArray(pkg.adult_guidance) ? pkg.adult_guidance.slice(0, 4) : ["把卡片放在孩子能看到、能选择的位置。", "接受指、点、拿卡片、文字、手势等多种表达方式。"],
    safety_note: pkg.safety_note || "这些卡片只是表达选项，不代表孩子一定有这些想法；使用前需要成人和专业人员确认。"
  };
}

function normalizePartner(pkg, provider, original, input = {}) {
  const steps = Array.isArray(pkg.rewritten_steps) ? pkg.rewritten_steps : [];
  return {
    provider: provider.name,
    source: provider.source,
    mode: "partner",
    original: pkg.original || original,
    communication_mode_label: modeLabel(input.communication_mode),
    rewritten_steps: steps.slice(0, 6),
    modeling_script: Array.isArray(pkg.modeling_script) ? pkg.modeling_script.slice(0, 5) : [],
    guidance: Array.isArray(pkg.guidance) ? pkg.guidance.slice(0, 4) : ["一次只说一个步骤。", "用具体动作代替抽象要求。"],
    safety_note: pkg.safety_note || "这是沟通材料草稿，不是医疗或治疗建议，需要成人和专业人员确认后使用。"
  };
}

function normalize(pkg, provider, input = {}) {
  return {
    provider: provider.name, source: provider.source,
    communication_mode_label: modeLabel(input.communication_mode),
    title: pkg.title || "AI 生成视觉流程支持",
    summary: pkg.summary || "这是一份供成人和专业人员审阅的视觉流程支持草稿。",
    visual_schedule: Array.isArray(pkg.visual_schedule) ? pkg.visual_schedule.slice(0, 8) : [],
    first_then: pkg.first_then || {},
    social_story: Array.isArray(pkg.social_story) ? pkg.social_story.slice(0, 8) : [],
    card_suggestions: Array.isArray(pkg.card_suggestions) ? pkg.card_suggestions.slice(0, 8) : [],
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
