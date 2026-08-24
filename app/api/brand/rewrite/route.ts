import { NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  collectFilePaths,
  makeTempCopy,
  disposeTempCopy,
  readTempFile,
  writeTempFile,
} from "@/lib/brand-pack";
import {
  extractCopyOccurrences,
  applyCopyToOccurrences,
} from "@/lib/brand-copy";
import { makeZip } from "@/lib/server-zip";
import { PROJECT_TYPES } from "@/data/project-types";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/brand/rewrite?site=Outstand
// body(可选): { projectName?, projectType?, narrative? }
// 流程：把整站复制到 os 临时目录 → 抽取英文文案 → Qwen 译成中文(长度对齐) → 重新打包 zip。
// 关键保证：改写只发生在临时副本，绝不写回原 outstand/ 目录 → 组件库预览与其他用户零影响。
export async function POST(req: NextRequest) {
  if (!rateLimit(`ai:${getClientIp(req)}`, 10, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  const siteId = req.nextUrl.searchParams.get("site") ?? "Outstand";
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const baseUrl = process.env.LLM_MODEL_BASE_URL?.replace(/\/+$/, "");
  const model = process.env.LLM_MODEL_MODEL_ID;
  const apiKey = process.env.LLM_MODEL_API_KEY;
  if (!baseUrl || !model || !apiKey) {
    return json(
      { error: "未配置 LLM（LLM_MODEL_BASE_URL / LLM_MODEL_MODEL_ID / LLM_MODEL_API_KEY），无法进行 AI 改写。" },
      400,
    );
  }

  let tmp: ReturnType<typeof makeTempCopy> | null = null;
  try {
    tmp = makeTempCopy(siteId);
    const { dir, site, root } = tmp;

    // 1) 抽取整站英文文案（服务端源码文件）
    const files = collectFilePaths(dir).filter((f) =>
      /\.(tsx|ts|jsx|js)$/i.test(f.rel),
    );
    const perFile: Map<number, ReturnType<typeof extractCopyOccurrences>> = new Map();
    const globalCount = new Map<string, number>();
    files.forEach((f, i) => {
      const src = readTempFile(root, f.rel);
      const occs = extractCopyOccurrences(src);
      perFile.set(i, occs);
      for (const o of occs) globalCount.set(o.value, (globalCount.get(o.value) || 0) + 1);
    });

    // 全量处理整站所有文案位（不去重低频项，避免漏译），按出现频率排序让高频先译
    const uniq = [...globalCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s);

    if (uniq.length === 0) {
      return json({ error: "未找到可翻译的文案。" }, 422);
    }

    // 2) LLM 创作（分批并行 + 失败重试，避免单次负载过重导致超时/500）
    const ctx = makeContext(body);
    let map = await translateAll(uniq, { baseUrl, model, apiKey }, ctx);
    if (map.size === 0) return json({ error: "AI 改写未能产出有效译文。" }, 502);
    map = await refineSuitStrings(uniq, map, { baseUrl, model, apiKey }, ctx); // 对跑偏成套话的长文案二次精修，拉回品牌
    const transMap = new Map<string, string>(map);

    // 仅保留真正改动的文案，作为「用户意愿文案字典」回传前端（供下载覆盖层复用）。
    // 响应头大小受限：base64 超过 5KB 则省略，不阻塞主流程（下载仍走已缓存的 -zh.zip）。
    const changedEntries = [...transMap].filter(([k, v]) => v && v !== k && v.trim());
    const copyMapObj = Object.fromEntries(changedEntries);
    const copyMapB64 = Buffer.from(JSON.stringify(copyMapObj), "utf8").toString("base64");
    const copyMapHeader = copyMapB64.length <= 5000 ? copyMapB64 : "";

    // 3) 把译文写回临时副本（仅改文案原文片段，import/标识符/路径原封不动）
    let rewrittenFiles = 0;
    let rewrittenNodes = 0;
    perFile.forEach((occs, i) => {
      if (!occs || occs.length === 0) return;
      const rel = files[i].rel;
      const src = readTempFile(root, rel);
      const next = applyCopyToOccurrences(src, occs, transMap);
      if (next !== src) {
        writeTempFile(root, rel, next);
        rewrittenFiles++;
        rewrittenNodes += occs.filter((o) => {
          const v = transMap.get(o.value);
          return v && v !== o.value && v.trim();
        }).length;
      }
    });

    // 4) 重新打包临时副本（同一项目根文件夹，可直接替换解压使用）
    const all = collectFilePaths(dir);
    const zip = makeZip(
      all.map((f) => ({
        name: `${site.rootName}/${f.rel}`,
        content: readTempFile(root, f.rel),
      })),
    );

    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(`${site.rootName}-zh.zip`)}"`,
        "X-Rewritten-Files": String(rewrittenFiles),
        "X-Rewritten-Nodes": String(rewrittenNodes),
        "X-Copy-Map": copyMapHeader,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message || "改写失败" }, 500);
  } finally {
    if (tmp) disposeTempCopy(tmp.dir);
  }
}

// ───────────────────────── helper ─────────────────────────

function json(obj: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeContext(body: Record<string, unknown>): {
  projectName?: string;
  projectType?: string;
  narrative?: string;
} {
  const narr = body?.narrative && typeof body.narrative === "object" ? (body.narrative as Record<string, unknown>) : null;
  const desc = narr && typeof narr.desc === "string" ? narr.desc.trim() : "";

  // 用户给了具体项目描述（desc）时：只给行业名作弱标签，不灌行业基建细节（SKU/支付/物流…），
  // 否则会盖过用户描述，把整站带偏成「电商系统官网」而不是「宠遇·宠物电商」。
  let typeLine = "";
  if (typeof body.projectType === "string") {
    const flat = PROJECT_TYPES.find((p) => p.id === body.projectType && !("group" in p));
    if (flat) {
      typeLine = desc
        ? `行业：${flat.name}（${flat.description}）`
        : [
            `行业：${flat.name}（${flat.description}）`,
            `业务定位：${flat.positioning}`,
            `目标用户：${flat.audience}`,
            `核心页面：${flat.corePages.join("、")}`,
            `核心功能：${flat.keyModules.join("、")}`,
            `变现：${flat.monetization}`,
            `合规注意：${flat.compliance}`,
          ].join("\n");
    } else {
      typeLine = `项目类型：${body.projectType}`;
    }
  }

  const narration = narr as Record<string, unknown>;
  const extra = narr
    ? [
        typeof narr.positioning === "string" ? `定位：${narr.positioning}` : "",
        typeof narr.vision === "string" ? `愿景：${narr.vision}` : "",
        Array.isArray(narr.targetAudience)
          ? `目标用户：${narr.targetAudience.filter((x) => typeof x === "string").join("、")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  // PRD 丰富的结构化素材，各取所需：一句话产品描述→品牌描述/副标题；分阶段→流程/服务/里程碑；
  // 业务角色→评价/团队/协作；业务专属页面→导航/站点地图；特种结构点→该业务独有的特色卖点。
  const description =
    typeof narration?.description === "string" ? narration.description : "";
  const phaseBlocks = Array.isArray(narration?.phases) && narration.phases.length
    ? narration.phases
        .filter((p) => p && typeof p === "object")
        .map((p: Record<string, unknown>) => {
          const nm = typeof p.name === "string" ? p.name : "";
          const items = Array.isArray(p.items)
            ? (p.items as unknown[])
                .filter((x) => typeof x === "string")
                .join(" → ")
            : "";
          return items ? `${nm}：${items}` : nm;
        })
        .filter(Boolean)
        .join("\n")
    : "";
  const roleBlocks = Array.isArray(narration?.roles) && narration.roles.length
    ? narration.roles
        .filter((r) => r && typeof r === "object")
        .map((r: Record<string, unknown>) => {
          const role = typeof r.role === "string" ? r.role : "";
          const scope = typeof r.scope === "string" ? r.scope : "";
          return scope ? `${role}（${scope}）` : role;
        })
        .filter(Boolean)
        .join("、")
    : "";
  const pageBlocks = Array.isArray(narration?.pages) && narration.pages.length
    ? narration.pages
        .filter((p) => p && typeof p === "object")
        .map((p: Record<string, unknown>) => {
          const nm = typeof p.name === "string" ? p.name : "";
          const de = typeof p.description === "string" ? p.description : "";
          return de ? `${nm}：${de}` : nm;
        })
        .filter(Boolean)
        .join("\n")
    : "";
  const extraBlocks =
    narration?.extra && typeof narration.extra === "object"
      ? Object.entries(narration.extra as Record<string, unknown>)
          .map(([k, v]) => {
            const val = Array.isArray(v)
              ? v.filter((x) => typeof x === "string").join("、")
              : String(v ?? "");
            return val ? `${k}：${val}` : "";
          })
          .filter(Boolean)
          .join("\n")
      : "";

  // PRD 核心功能：把「功能名 + 解决什么问题」完整展开成亮点清单一并喂给模型，
  // 让不同内容区块能各自从相关功能里提炼差异化的丰满文案，而不是只剩功能名拼一行。
  const featureBlocks = Array.isArray(narr?.coreFeatures) && narr.coreFeatures.length
    ? narr.coreFeatures
        .filter((f) => f && typeof f === "object")
        .map((f, i) => {
          const name = typeof f.name === "string" ? f.name.trim() : "";
          const why = typeof f.why === "string" ? f.why.replace(/\s+/g, " ").trim() : "";
          if (!name) return "";
          const line = why ? `${i + 1}. ${name}：${why}` : `${i + 1}. ${name}`;
          return line.replace(/^[.:：]\s*/, "");
        })
        .filter(Boolean)
        .join("\n")
    : "";

  // 核心业务（用户描述）放最前，作为创作的主导背景；desc 缺失时用定位/愿景兜底。
  const primaryDesc = desc || (narr && typeof narr === "object"
    ? (typeof narr.positioning === "string" ? narr.positioning : "") ||
      (typeof narr.vision === "string" ? narr.vision : "")
    : "");
  const narrative = [
    primaryDesc ? `核心业务：${primaryDesc}` : "",
    description ? `一句话产品描述：${description}` : "",
    typeLine,
    extra,
    featureBlocks ? `【核心功能亮点】\n${featureBlocks}` : "",
    pageBlocks ? `【业务专属页面】\n${pageBlocks}` : "",
    phaseBlocks ? `【分阶段规划】\n${phaseBlocks}` : "",
    roleBlocks ? `【业务角色】\n${roleBlocks}` : "",
    extraBlocks ? `【业务特色（该业务独有的结构点）】\n${extraBlocks}` : "",
  ]
    .filter(Boolean)
    .join("\n") || undefined;

  return {
    projectName: typeof body.projectName === "string" ? body.projectName : undefined,
    projectType: typeLine,
    narrative,
  };
}

/** 从项目名里抽出「品牌核心词」（中英文都保留），用于提示词里的硬校验示例。 */
function brandCoreWords(ctx: { projectName?: string }): { zh: string[]; en: string[] } {
  const name = (ctx?.projectName || "").trim();
  const zh = name.match(/[\u4e00-\u9fa5]+/g) || [];
  const en = name.match(/[A-Za-z0-9]+/g) || [];
  return { zh, en };
}

/** 拼出供提示词「硬校验」用的品牌核心词表（品牌名 + 核心业务词 + 类型行业词）。 */
function buildCoreWords(ctx: {
  projectName?: string;
  projectType?: string;
  narrative?: string;
}): string {
  const { zh, en } = brandCoreWords(ctx);
  const out = [...zh, ...en];
  // narrative 里的「核心业务」短句，抽出常见行业词补进去
  if (ctx?.narrative) {
    for (const kw of ["宠物", "毛孩子", "猫粮", "狗粮", "电商", "商城", "医疗", "健康", "教育", "课程", "SaaS", "金融", "理财", "招聘", "餐饮", "旅行", "家居", "服饰", "美妆"]) {
      if (ctx.narrative.includes(kw) && !out.includes(kw)) out.push(kw);
    }
  }
  if (ctx?.projectType) {
    const t = ctx.projectType.match(/行业：([^（]+)/);
    if (t && !out.includes(t[1])) out.push(t[1]);
  }
  return out.length ? out.join("、") : "";
}

export const SYSTEM_PROMPT = (indexesHint: string, brandName?: string, brandWords?: string) => `你是一位顶级品牌文案与行业内容策略专家。你要把一套英文网站模板的全部「文案位」重写成简体中文，目标是让它**看起来就是这个项目自己的官网**，而不是任何行业都能套上的模板。

【正在服务的项目】品牌名：${brandName || "（未提供品牌名）"}。项目是什么样的业务，由下方「项目背景」给出（用户消息里有行业、定位、目标用户、核心页面/功能/卖点）。你的一切创作都以这个具体项目为中心。

【品牌核心词——硬校验】这个项目一眼能认出的词是：${brandWords || "（品牌名或其业务关键词）"}。
在以下几个位置，**必须自然融入至少一个上面这些词（或明显的行业业务词）**，否则判为不合格并重写：
- Hero 主标题、Hero 副标题、关键小节标题、CTA、品牌描述。
判定口诀：读者把这句话里的品牌词/业务词换成别家，如果依然成立，就说明你没写到位，需要重写。

【核心：是"创作"，不是"翻译"】
每一处英文原文（JSON 的 key）只用来告诉你"这个位置原本放什么、承担什么角色"（导航 / Hero 主标题 / 副标题 / 段落卖点 / FAQ 问题 / 流程步骤 / 数据指标 / 客户评价 / CTA 按钮…）。请按它的角色，围绕本项目真实业务重新创作：
- **不要被英文的字面措辞框死。** 例如英文写 "Tailored to Your Business: Modern, Efficient, Professional Website Template"，如果项目是宠物电商「宠遇 Pety」，主标题应直接表达宠遇的价值主张（如"给毛孩子科学又省心的宠爱"），而不是"为您的业务量身打造 / 现代、高效、专业的电商模板"这种谁都能用的空话。
- hero 要以「核心业务」为主体重写，直接点明这个品牌是谁、主营什么（例：品牌是宠物用品电商时，主标题要像"给毛孩子科学又省心的宠爱"——能看到品牌名或"宠物/毛孩子"这类业务词），**严禁写成"电商系统/交易平台/品牌官网/让品牌走向全球/为您的业务量身打造/现代、高效、专业"这类放哪都成立的泛行业功能描述**。
- FAQ / 服务 / 流程 / 数据 / 评价：写成这个项目真实会有的内容（宠物电商就写粮、零食、用品、配送、售后、订阅等）。
- 项目背景里若给了更具体的结构化素材，按下述对号入座取用（不要套模板话）：「一句话产品描述」→ 品牌描述 / Hero 副标题；「【分阶段规划】」→ 服务/流程/里程碑，把每一步写具体；「【业务角色】」→ 客户评价、团队、协作场景；「【业务专属页面】」→ 导航 / 站点链接的命名；「【业务特色】」→ 该业务独有的卖点（如定价模式、分发渠道、冷启动策略等），写进最能体现差异的板块。

【分板块特征】不同文案位写法不同。项目背景里给了「【核心功能亮点】」——这是本项目独有的功能清单（每个功能都标注了它解决什么问题），你必须从这些亮点里为不同板块提炼出**差异化、具体、丰满**的内容：
- **Hero 主标题 / 副标题**：点出品牌的核心价值主张，一眼让人知道这是谁、卖什么、解决什么——从「核心业务 + 定位 + 愿景」里提一两个最有冲击力的点，别堆叠。
- **功能/特性区块（Features）**：把每条【核心功能亮点】各写成一句有信息量的卖点，说清"这个功能解决什么、对用户有什么好处"，**每条都不重复、内容丰满**，正是让整站看起来"有这个品牌独有的东西"的关键。
- **服务/流程区块**：围绕具体业务写真实步骤（宠物电商就写选品、下单、极速配送、售后、订阅续费）。
- **FAQ**：像真实用户会问的问题（价格怎么算、配送多久、售后怎么处理、会不会伤宠物、怎么联系），答案给真实有用的具体信息。
- **数据指标 / 小标签**：贴合业务的可信数字（宠物电商如"会员超 10 万""48 小时达""100% 溯源"）。
- **客户评价**：像真实买家口吻，提到具体的场景和体验，不要空泛夸"好"。
- **CTA / 按钮 / 导航**：短、直接，像真实站点叫法（"立即选购""联系客服""预约到家"）。
不同板块从各有侧重，合起来构成一个丰满、立体的品牌形象，而不是同一个调调重复。
整站术语、语气、品牌名译法统一，像同一个团队一天内写的。

【禁令——写出来放到任何行业都成立的，一律不合格】
除非原文确实是品牌口号，否则禁止出现：对您的业务量身打造 / 现代高效专业 / 专业团队 / 专业解决方案 / 一站式 / 打造品牌 / 打造 X 平台或模板 / 助力企业 / 卓越品质 这类与具体项目无关的万能句。
若某句文案换成别的行业依然成立，就必须重写为只属于本项目的话。

【硬性格式要求】
1. 只输出一个 JSON 对象：key 严格等于我给出的每一项原文（原样大小写/标点），value 是对应的简体中文创作结果。
2. ${indexesHint}
3. {长度对齐——防止布局崩坏}：原文短则结果短（按钮/标签/导航 1~4 词 → 通常 3~8 个中文字）；整句/段落保持原句数与换行节奏，不缩写、不增删、不合并分割。
4. 只输出 JSON，不要 markdown 代码块，不要任何解释。`;

function translateTask(uniq: string[], ctx: { projectName?: string; projectType?: string; narrative?: string }): string {
  const background =
    ctx.narrative ||
    (ctx.projectName ? `项目名称：${ctx.projectName}` : "") ||
    "（未提供项目背景。默认：一家专业数字设计工作室，面向全球品牌，做品牌识别与网站设计开发。）";
  const bw = brandCoreWords(ctx);
  const core = [...bw.zh, ...bw.en].filter(Boolean);
  const coreLine = core.length
    ? `【本项目品牌核心词】${core.join("、")}——Hero 主标题、Hero 副标题、关键小节标题、CTA、品牌描述这几处，必须自然融入至少一个这些词（或明显的行业业务词）。`
    : "";
  const lines = [
    "项目背景：",
    ctx.projectName ? `品牌名：${ctx.projectName}（整站文案必须围绕这个品牌创作，Hero 标题/关键小节尽量直接体现它，禁用与该项目无关的万能套话）` : "",
    background,
    coreLine,
    "",
    "以下 JSON 对象的 key 是需要处理的文案位，请逐项输出重写结果：",
    JSON.stringify(Object.fromEntries(uniq.map((s) => [s, ""]))),
  ].filter((l) => l !== undefined);
  return lines.join("\n");
}

const SHORT_BATCH = 150; // 短文案(按钮/导航/标签)批大小：量大、创作空间小
const LONG_BATCH = 12; // 长文案(标题/段落/FAQ答案)批大小：越小越聚焦，避免批量稀释成模板腔
const LONG_LEN = 18; // 字符数阈值：大于视为长文案
const MAX_ATTEMPTS = 2; // 单个批次失败重试次数
const BATCH_TIMEOUT = 120_000;
const MAX_CONCURRENCY = 4; // 并发的批次上限

/** 分批并行(限流)创作，合并结果；个别批次失败会重试，重试仍失败则该批按「跳过」处理。 */
async function translateAll(
  uniq: string[],
  client: { baseUrl: string; model: string; apiKey: string },
  ctx: { projectName?: string; projectType?: string; narrative?: string },
): Promise<Map<string, string>> {
  // 长文案对创作质量敏感，用更小的批；短文案量大、创作空间小，用大一些的批。先喂长批。
  const longStrings = uniq.filter((s) => s.length > LONG_LEN);
  const shortStrings = uniq.filter((s) => s.length <= LONG_LEN);
  const chunks: string[][] = [];
  for (let i = 0; i < longStrings.length; i += LONG_BATCH) {
    chunks.push(longStrings.slice(i, i + LONG_BATCH));
  }
  for (let i = 0; i < shortStrings.length; i += SHORT_BATCH) {
    chunks.push(shortStrings.slice(i, i + SHORT_BATCH));
  }

  const merged = new Map<string, string>();
  let cursor = 0;
  const runner = async () => {
    while (cursor < chunks.length) {
      const idx = cursor++;
      const c = chunks[idx];
      try {
        const r = await translateWithRetry(c, client, ctx);
        for (const [k, v] of r) if (v.trim()) merged.set(k, v.trim());
      } catch (e) {
        console.error("[brand-rewrite] batch failed:", (e as Error)?.message);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, chunks.length) }, runner),
  );
  return merged;
}

async function translateWithRetry(
  batch: string[],
  client: { baseUrl: string; model: string; apiKey: string },
  ctx: { projectName?: string; projectType?: string; narrative?: string },
): Promise<Map<string, string>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await translateBatchOnce(batch, client, ctx);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

async function translateBatchOnce(
  batch: string[],
  client: { baseUrl: string; model: string; apiKey: string },
  ctx: { projectName?: string; projectType?: string; narrative?: string },
): Promise<Map<string, string>> {
  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${client.apiKey}`,
    },
    body: JSON.stringify({
      model: client.model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT("逐项完成、长度对齐。", ctx?.projectName, buildCoreWords(ctx)),
        },
        { role: "user", content: translateTask(batch, ctx) },
      ],
    }),
    signal: AbortSignal.timeout(BATCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`AI 改写服务返回错误（${res.status}）。`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI 改写返回了无法解析的内容。");
  }
  const map = new Map<string, string>();
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) map.set(k, v.trim());
    }
  }
  return map;
}

// ───────────────────── 二次精修：把跑偏成套话的长文案拉回品牌 ─────────────────────

/** 落到「任何行业都成立」的套话信号词——命中即判定这条初稿跑偏了。 */
const SUIT_PHRASES = [
  "量身", "一站式", "现代化", "一体化", "全面", "赋能", "助力",
  "模板", "Framer", "为您的", "为品牌", "让您的品牌", "为你的",
  "专业团队", "专业解决方案", "电商平台", "交易平台", "交易系统",
  "平台", "系统", "解决方案", "打造", "您的品牌", "品牌设计",
  "您的业务", "让你的事业", "帮您", "助您", "助你", "提供全面的",
];

/** 是否命中常见套话（长文案里）。 */
function hitsSuitPhrase(s: string): boolean {
  return SUIT_PHRASES.some((w) => s.includes(w));
}

/** 是否命中「关键词硬校验」失败：关键标题里完全看不到品牌/业务词。 */
function missingBrandWords(s: string, core: string[]): boolean {
  if (core.length === 0) return false;
  return !core.some((w) => s.includes(w));
}

const REFINE_BATCH = 3; // 精修用极小批，聚焦单条长文案
const REFINE_CONCURRENCY = 5;
const REFINE_LEN = 18; // 只对较长文案精修（标题/段落/FAQ答案），短按钮标签不折腾
const REFINE_MAX_ROUNDS = 3; // 循环精修最多轮数，直到全部脱离套话

const REFINE_PROMPT = (
  brandName: string | undefined,
  brandWords: string,
) => `你是一位品牌文案精修专家。下面这些文案位是某网站的中文初稿，被写成了「放任何行业都成立」的通用套话，或完全没有体现品牌。请逐条重写，使其：
- 一眼能看出是「${brandName || "该项目"}」的官网——主标题/副标题/关键小节**必须自然融入至少一个这些品牌核心词：${brandWords || "品牌名或其核心业务词"}**（或明显的行业业务词），禁止写成不带任何品牌味道的通用句；
- 像这个品牌真实会写给目标用户的话，有语调、有信息量；
- 篇幅与原英文（JSON key 即为原文，value 为当前初稿）大致相当，不拉长不缩水。

【禁令】凡属通用套话都必须规避并改写：量身打造 / 现代化 / 一体化 / 赋能 / 助力 / 一站式 / 为您的业务 / 您的业务 / 专业的XX平台或系统或模板 / 解决方案 / 打造品牌 / 现代高效专业 / 让品牌走向全球 等。

只输出 JSON：key 严格等于原文，value 为精修后的简体中文。`;

function refineTask(
  batch: string[],
  draft: Map<string, string>,
  ctx: { projectName?: string; projectType?: string; narrative?: string },
): string {
  const background = ctx.narrative || ctx.projectName || "";
  const core = buildCoreWords(ctx);
  const items: Record<string, string> = {};
  for (const k of batch) {
    const cur = draft.get(k);
    if (cur) items[k] = cur;
  }
  return [
    "项目背景：",
    ctx.projectName ? `品牌名：${ctx.projectName}` : "",
    background,
    core ? `【必须融入的品牌核心词】${core}——每条正文至少要出现其中一个词。` : "",
    "以下 JSON：key=英文原文（仅作字数/角色对照），value=当前初稿（需精修）",
    JSON.stringify(items),
  ].filter((l) => l !== undefined).join("\n");
}

async function refineBatchOnce(
  batch: string[],
  draft: Map<string, string>,
  client: { baseUrl: string; model: string; apiKey: string },
  ctx: { projectName?: string; projectType?: string; narrative?: string },
): Promise<Map<string, string>> {
  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${client.apiKey}` },
    body: JSON.stringify({
      model: client.model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: REFINE_PROMPT(ctx?.projectName, buildCoreWords(ctx)) },
        { role: "user", content: refineTask(batch, draft, ctx) },
      ],
    }),
    signal: AbortSignal.timeout(BATCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`AI 精修服务返回错误（${res.status}）。`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI 精修返回了无法解析的内容。");
  }
  const map = new Map<string, string>();
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) map.set(k, v.trim());
    }
  }
  return map;
}

/** 对跑偏成套话 / 不含品牌核心词的长文案，循环精修直到脱离套话（最多 REFINE_MAX_ROUNDS 轮）。 */
async function refineSuitStrings(
  uniq: string[],
  draft: Map<string, string>,
  client: { baseUrl: string; model: string; apiKey: string },
  ctx: { projectName?: string; projectType?: string; narrative?: string },
): Promise<Map<string, string>> {
  const core = buildCoreWords(ctx).split("、").filter(Boolean);
  let current = new Map(draft);

  for (let round = 0; round < REFINE_MAX_ROUNDS; round++) {
    const targets = uniq.filter((s) => {
      const v = current.get(s);
      if (!v || s.length <= REFINE_LEN) return false;
      const lenOk = v.length >= 8;
      // 短标题(8~40字)→ 强校验：既不能是套话，也必须含品牌核心词；
      // 长段落(>40字)→ 只校验套话，避免为凑品牌词把正文写僵硬。
      if (!lenOk) return false;
      if (v.length <= 40) return hitsSuitPhrase(v) || missingBrandWords(v, core);
      return hitsSuitPhrase(v);
    });
    if (targets.length === 0) break;

    const chunks: string[][] = [];
    for (let i = 0; i < targets.length; i += REFINE_BATCH) {
      chunks.push(targets.slice(i, i + REFINE_BATCH));
    }

    const refined = new Map<string, string>();
    let cursor = 0;
    const runner = async () => {
      while (cursor < chunks.length) {
        const idx = cursor++;
        try {
          const r = await refineBatchOnce(chunks[idx], current, client, ctx);
          for (const [k, v] of r) if (v.trim()) refined.set(k, v.trim());
        } catch (e) {
          console.error("[brand-rewrite] refine batch failed:", (e as Error)?.message);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(REFINE_CONCURRENCY, chunks.length) }, runner),
    );

    const next = new Map(current);
    for (const [k, v] of refined) if (v && v.trim()) next.set(k, v.trim());
    current = next;
  }
  return current;
}