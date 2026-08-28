/**
 * 表格处理 —— 清洗标准化层（Step 3）
 *
 * 链路：detectHeaderRow → cleanCellValue（逐 cell）→ inferColumnType（逐列）→ cleanSheet 整合。
 * 纯计算，错误信息明确抛出；覆盖第二段规格：全角→半角/千分位/中文单位/百分比/货币/括号负数/Excel 序列号/季度标记等。
 */

import type { EffectiveDataset, ExcludedColumn, ExcludedRow, FieldType, SheetInfo } from "./types";
import { detectTableQualityIssues } from "./quality";

/* ─────────────── 单元常量 ─────────────── */

/** 常见空值文本（不区分大小写） */
const NULL_LIKE_PATTERNS = /^(n\/?a|null|nil|无|没有|暂无|-{1,2}|—|--|nan)$/i;

/** 布尔判定：匹配 80% 以上即认为列是 boolean */
const BOOLEAN_REGEX = /^(true|false|是|否|yes|no|y|n|t|f)$/i;

/** 日期判定（粗筛：表层符合日期格式才进入深解析） */
const DATE_SURFACE_REGEX =
  /^(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;

/** 货币符号 */
const CURRENCY_REGEX = /[¥$€£￥]/;

/** 中文大数单位 */
const CHINESE_UNIT = /[万亿]$/;

/* ─────────────── 强模式类型识别（证件 / 电话） ─────────────── */
/* 目的：身份证 / 护照 / 手机号这类「强格式业务标识」，不依赖列名语义也能高置信识别，
 *      避免它们被回退为 text 后判为低置信、再推给用户逐个确认（脏表导入的主要交互负担）。 */

/** 中国大陆手机号：1[3-9] 开头 11 位；允许 +86 国际码与常见分隔符 */
const CN_MOBILE_RE = /^(\+?86[-\s]?)?1[3-9]\d{9}$/;
/** 电话（固话 / 带区号 / 分机）：形态宽松，仅在列名含电话语义词时启用，避免误伤长数字 ID */
const PHONE_LIKE_RE = /^(\+?\d{1,3}[-\s]?)?(\(?\d{2,4}\)?[-\s]?)?\d{7,8}([-\s]?\d{1,5})?$/;
/** 中国大陆身份证：18 位（末位可为 X/x）或 15 位旧版 —— 强模式，不依赖列名 */
const CN_ID_CARD_RE = /^(\d{17}[\dXx]|\d{15})$/;
/** 护照 / 通行证 / 军官证等：单个字母 + 7~12 位数字（如 E12345678）—— 强模式 */
const PASSPORT_LIKE_RE = /^[A-Za-z]\d{7,12}$/;
/** 证件号弱形态：8~18 位字母数字混合且同时含字母与数字 —— 仅在列名含证件语义词时启用 */
const CERT_NO_LOOSE_RE = /^(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{8,18}$/;

/* ─────────────── 单 cell 清洗 ─────────────── */

/**
 * 单 cell 清洗：空白处理 → 空值匹配 → 数字/日期解析 → 返回原 string（兜底）
 * @param value 原始值
 * @param inferredType 可选；指定后会优先按该类型解析
 */
export function cleanCellValue(value: unknown, inferredType?: FieldType): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  // ① 空白字符处理：全角→半角、零宽字符删除、trim、连续空白压缩
  const s = value
    .replace(/\u3000/g, " ") // 全角空格
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // 零宽字符
    .trim()
    .replace(/\s+/g, " ");

  if (s === "") return null;

  // ② 空值标准化（"0" 保留）
  if (s === "0" || s === "0.0" || s === "0.00") return 0;
  if (NULL_LIKE_PATTERNS.test(s)) return null;

  // ②.5 H7/H8 修复：前导零数字码（SKU/门店编码/固话等）与超长纯数字串（身份证/大整数等）
  // 保留为 text，避免 "001"→1 改坏编码、或 >2^53 整数被 Number() 静默丢精度。
  // 注意：仅匹配「纯数字串」，带小数点的正常小数（如 0.5、123.45）不在此列，照常解析。
  if (/^0\d+$/.test(s) || /^\d{16,}$/.test(s)) {
    return s;
  }

  // ③ 数字解析
  if (
    !inferredType ||
    inferredType === "integer" ||
    inferredType === "float" ||
    inferredType === "percentage" ||
    inferredType === "currency"
  ) {
    const num = parseNumericString(s);
    if (num !== null) return num;
  }

  // ④ 日期解析
  if (!inferredType || inferredType === "date") {
    const date = parseDateString(s);
    if (date !== null) return date;
  }

  // ⑤ 兜底：返回清洗后的字符串
  return s;
}

/**
 * 数字字符串解析：覆盖 千分位 / 中文单位 / 百分比 / 货币 / 括号负数 / 中文负数 / 科学计数
 * @returns 数字；解析失败返回 null
 */
export function parseNumericString(s: string): number | null {
  if (!s) return null;
  let t = s.trim();
  if (!t) return null;

  // 括号负数 (500) → -500
  if (/^\(.*\)$/.test(t)) t = "-" + t.slice(1, -1);

  // 中文负数 "负500" → -500
  t = t.replace(/^负(?=[\d.])/, "-");

  // 货币符号
  t = t.replace(CURRENCY_REGEX, "");

  // 千分位逗号
  t = t.replace(/,/g, "");

  // 中文单位
  let mult = 1;
  if (t.endsWith("亿")) {
    mult = 1e8;
    t = t.slice(0, -1);
  } else if (t.endsWith("万")) {
    mult = 1e4;
    t = t.slice(0, -1);
  }

  // 百分比
  let isPct = false;
  if (t.endsWith("%")) {
    isPct = true;
    t = t.slice(0, -1);
  }

  const num = Number(t);
  if (!Number.isFinite(num)) return null;
  return isPct ? num / 100 : num * mult;
}

/**
 * 日期字符串解析：覆盖 5 种格式 + Excel 序列号 + Unix 时间戳
 * @returns ISO 字符串（YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS）；无法解析返回 null
 */
export function parseDateString(s: string): string | null {
  const t = s.trim();
  if (!t) return null;

  // 1. ISO YYYY-MM-DD 或 YYYY/MM/DD（可含时间）
  let m = t.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (m) {
    return formatDate(+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : undefined);
  }

  // 2. 中文 YYYY年M月D日
  m = t.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (m) return formatDate(+m[1], +m[2], +m[3]);

  // 3. 美式 MM/DD/YYYY 或 欧式 DD/MM/YYYY（若首段>12 必为欧式）
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    if (a > 12) return formatDate(+m[3], b, a); // 欧式
    return formatDate(+m[3], a, b); // 美式
  }

  // 4. 两位年 MM/DD/YY
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = 2000 + +m[3];
    if (a > 12) return formatDate(y, b, a);
    return formatDate(y, a, b);
  }

  // 5. Excel 序列号（数字 1000~100000 → 1900-01-01 起算）
  if (/^\d{4,5}(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n >= 1000 && n < 100000) {
      return excelSerialToISO(n);
    }
  }

  // 6. Unix 时间戳（10 位秒级，13 位毫秒级）
  if (/^\d{10}$/.test(t)) {
    const d = new Date(+t * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (/^\d{13}$/.test(t)) {
    const d = new Date(+t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace("T", " ");
  }

  return null;
}

/** Excel 序列号 → ISO（1900 系统，含 1900 闰年 bug） */
function excelSerialToISO(n: number): string {
  // 1899-12-30 作为基准（避开 Excel 1900-02-29 假闰日）
  const base = Date.UTC(1899, 11, 30);
  const d = new Date(base + Math.floor(n) * 86400_000);
  return d.toISOString().slice(0, 10);
}

function formatDate(y: number, mo: number, d: number, h?: number): string | null {
  if (!isValidDate(y, mo, d)) return null;
  const date = `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
  if (h === undefined || isNaN(h)) return date;
  return `${date} ${pad2(h)}:00:00`;
}

function isValidDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/* ─────────────── 表头识别 ─────────────── */

/**
 * 自动检测表头行索引：扫描前 10 行打分（最高分行 = 表头）
 * 打分维度：非空率(40) + 字符串占比(30) + 与下一行类型差异(20) + 唯一性(10)
 */
export function detectHeaderRow(rows: unknown[][]): number {
  const MAX = 10;
  const candidates = rows.slice(0, MAX);
  if (candidates.length === 0) return 0;

  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i] || [];
    const next = candidates[i + 1] || [];
    let score = 0;

    // ① 非空率
    const nonEmpty = row.filter((c) => c != null && String(c).trim() !== "").length;
    const nonEmptyRate = row.length > 0 ? nonEmpty / row.length : 0;
    score += nonEmptyRate * 40;

    // ② 字符串占比（表头通常全是文本）
    const strCount = row.filter((c) => typeof c === "string" || c == null).length;
    const strRate = row.length > 0 ? strCount / row.length : 0;
    score += strRate * 30;

    // ③ 与下一行的类型差异（表头全字符串，下一行开始有数字/日期）
    if (next.length > 0) {
      const nextNumeric = next.filter(
        (c) =>
          typeof c === "number" ||
          (typeof c === "string" && /^-?[\d.,]+/.test(String(c).trim())),
      ).length;
      const nextNumericRate = nextNumeric / next.length;
      score += nextNumericRate * 20;
    }

    // ④ 唯一性（表头不应有重复）
    const seen = new Set<string>();
    let unique = 0;
    for (const c of row) {
      const k = String(c ?? "").trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        unique++;
      }
    }
    const uniqueRate = row.length > 0 ? unique / row.length : 0;
    score += uniqueRate * 10;

    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return best;
}

/* ─────────────── 字段类型推断（T1-B 增强） ─────────────── */

/**
 * 推断阈值集中配置（T1-B）：所有魔法数字集中此处，不散落在函数内部，便于测试与调参。
 */
export const INFERENCE_THRESHOLDS = {
  /** 布尔形态值比例阈值（≥ 则判定 boolean） */
  BOOLEAN_RATIO: 0.8,
  /** 日期可解析比例阈值（纯值形态，≥ 则高置信 date） */
  DATE_PARSE_RATIO: 0.8,
  /** 列名含日期语义词时的最低可解析比例（放宽，因为语义已强） */
  DATE_NAME_MIN_RATIO: 0.5,
  /** 数值可解析比例阈值（纯值形态，≥ 则进入数值分支） */
  NUMERIC_RATIO: 0.8,
  /** 列名含金额语义词时的最低可解析比例 */
  CURRENCY_NAME_MIN_RATIO: 0.5,
  /** 含百分号即判定 percentage 的比例阈值 */
  PERCENTAGE_COL_RATIO: 0.5,
  /** 分类判定：唯一率低于此值（且唯一数 < CATEGORY_MAX_UNIQUE）→ category */
  CATEGORY_UNIQUE_RATIO: 0.1,
  /** 分类判定：唯一数低于此值（且唯一率 < CATEGORY_UNIQUE_RATIO）→ category */
  CATEGORY_MAX_UNIQUE: 50,
  /** email 形态值比例阈值（≥ 则判定 email） */
  EMAIL_PARSE_RATIO: 0.9,
  /** 手机号形态值比例阈值（≥ 则判定 phone，无需列名语义） */
  PHONE_PARSE_RATIO: 0.9,
  /** 列名含电话语义词时的最低可解析比例（放宽，因为语义已强） */
  PHONE_NAME_MIN_RATIO: 0.5,
  /** 强模式证件号（身份证 / 护照）值比例阈值（≥ 则判定 id，不要求高唯一率） */
  CERT_PATTERN_RATIO: 0.9,
  /** 列名含 ID 语义词时，值符合 ID 格式的最小比例 */
  ID_NAME_PATTERN_RATIO: 0.9,
  /** 值驱动 ID 判定的唯一率阈值（≥ 且格式符合 → id，即使列名无语义词） */
  ID_UNIQUENESS_RATIO: 0.95,
  /** ID 判定的最小非空样本数（覆盖小表如 4 行 Products；与唯一率阈值共同防止偶发唯一） */
  ID_MIN_NONNULL: 4,
  /** 高置信度门槛（≥ 视为稳定推断） */
  CONFIDENCE_HIGH: 0.85,
  /** 中置信度门槛（< 视为低置信度，需 UI 明确提示） */
  CONFIDENCE_MEDIUM: 0.6,
} as const;

/** 中英文列名语义词表（集中维护、可扩展；用于类型推断的列名线索） */
export const ID_NAME_HINTS = [
  "订单号", "订单编号", "单号", "编号", "商品编码", "货号", "条码",
  "code", "reference", "ref", "tracking", "跟踪号", "追踪号",
  // 证件 / 卡号 / 账号类业务标识
  "证件号", "证件编号", "证件", "身份证", "护照", "通行证", "驾驶证", "军官证", "海员证",
  "居住证", "签证", "卡号", "会员号", "账号", "学号", "工号", "员工号",
  "idcard", "passport", "certificate", "certno", "cardno", "license",
];
export const EMAIL_NAME_HINTS = ["邮箱", "电子邮件", "email", "e-mail", "mail"];
/** 电话语义词：命中后用宽松电话形态判定（PHONE_LIKE_RE） */
export const PHONE_NAME_HINTS = [
  "手机", "电话", "联系电话", "联系方式", "联系方式", "座机", "固话", "手机号", "移动电话",
  "mobile", "phone", "tel", "contact", "cellphone",
];
/** 证件语义词：命中后启用宽松证件形态（CERT_NO_LOOSE_RE）判定为 id */
export const CERT_NAME_HINTS = [
  "证件号", "证件编号", "证件", "身份证", "护照", "通行证", "驾驶证", "军官证", "海员证",
  "居住证", "签证", "idcard", "passport", "certificate", "certno",
];
/** 姓名 / 名称类语义词：命中即「确定是文本」而非「拿不准」，避免姓名字段被判低置信后阻断分析 */
export const NAME_TEXT_HINTS = [
  "姓名", "名字", "人名", "名称", "用户名", "客户名", "联系人", "收货人", "付款人", "经办人",
  "昵称", "花名", "称呼", "旅客", "乘客", "员工姓名", "负责人",
  "name", "username", "fullname", "firstname", "lastname", "nickname",
];
export const CATEGORY_NAME_HINTS = [
  "国家", "地区", "区域", "渠道", "物流渠道", "物流商", "状态", "退款状态", "商品状态", "物流状态",
  "标签", "分类", "类别", "广告组", "平台", "店铺", "类型", "分组", "品类", "品牌", "部门",
];
export const DATE_NAME_HINTS = [
  "日期", "时间", "下单日期", "发货日期", "签收日期", "注册日期",
  "年", "月", "日", "date", "time", "created", "updated",
  // 高频日期变体（出生 / 到期 / 生效 / 创建更新等）
  "出生", "生日", "诞生", "到期", "截止", "生效", "失效", "过期", "届满",
  "开始", "结束", "创建", "更新", "修改", "审核", "发布", "上架", "下架",
  "birthday", "birth", "expire", "expiry", "deadline", "start", "end",
];
export const CURRENCY_NAME_HINTS = [
  "金额", "销售额", "收入", "营收", "成本", "售价", "单价", "运费", "费用", "消耗",
  "预算", "利润", "总额", "总价", "结算", "实付", "付款", "价格",
];

/** 列名归一化（小写 + 去空格，用于语义词匹配） */
function normalizeColName(name?: string): string {
  return (name ?? "").toLowerCase().replace(/\s+/g, "");
}
function hasNameHint(name: string | undefined, hints: readonly string[]): boolean {
  const n = normalizeColName(name);
  return hints.some((h) => n.includes(h.toLowerCase()));
}

/** ID 形态：字母数字开头 + 字母数字/分隔符（含中英文斜杠）组合，且至少含一个非数字字符（排除纯数字误判为整数 id） */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-／/.]*$/;
/** 是否像 ID：满足 ID 形态且含有字母或分隔符（纯数字不算 id，避免与 integer 冲突） */
function looksLikeId(s: string): boolean {
  return ID_PATTERN.test(s) && /[A-Za-z_\-／/.]/.test(s);
}
/** email 形态（不可执行、纯正则；不读取或暴露完整邮箱内容到日志以外） */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 字段类型推断（T1-B 增强）：列名语义 + 样本值形态 + 非空比例 + 唯一率 + 可解析比例 + 混合值比例
 * → 推断类型、置信度、推断原因、样本统计。
 *
 * 不新增平行推断引擎：本函数是原 inferColumnType 的增强版，原签名通过 inferColumnType 兼容包装保留。
 * 所有推断只消费传入的 values（cleanSheet 传入清洗前 sheet 有效行；profiler 传入 EffectiveDataset 有效行），
 * 不回退读取原始未清洗数据。
 *
 * @param values 同一列的样本值（cleanSheet 传原始、profiler 传已清洗均安全：数值会先 String()）
 * @param name   列名（可选；用于列名语义线索）
 */
export function inferColumnTypeDetailed(
  values: unknown[],
  name?: string,
): import("./types").TypeInferenceResult {
  const strs = values.map((v) => (v == null ? "" : String(v).trim()));
  const nonNull = strs.filter((s) => s !== "" && !NULL_LIKE_PATTERNS.test(s));
  const nonNullCount = nonNull.length;
  const uniqueCount = new Set(nonNull).size;
  const uniqueRatio = nonNullCount > 0 ? uniqueCount / nonNullCount : 0;

  if (nonNullCount === 0) {
    return {
      inferredType: "text",
      confidence: 0,
      reasons: ["该列无任何有效值（空列），建议从分析中排除"],
      parseStats: { nonNullCount: 0, parseableCount: 0, uniqueCount: 0, uniqueRatio: 0, invalidCount: 0 },
    };
  }

  // 值形态统计
  const boolCount = nonNull.filter((s) => BOOLEAN_REGEX.test(s)).length;
  const boolRatio = boolCount / nonNullCount;
  const emailCount = nonNull.filter((s) => EMAIL_PATTERN.test(s)).length;
  const emailRatio = emailCount / nonNullCount;
  // H9：Excel 序列号（如 45320 → 2024-01-29）也计入可解析日期，避免纯序列号列被误判为整数。
  // 序列号窗口限定为 plausible 日期范围（~1954–2091），过滤掉小整数计数/数量列（<20000 或 >70000）。
  const EXCEL_SERIAL_MIN = 20000;
  const EXCEL_SERIAL_MAX = 70000;
  const isExcelSerial = (s: string) => {
    const n = Number(s);
    return Number.isInteger(n) && n >= EXCEL_SERIAL_MIN && n <= EXCEL_SERIAL_MAX && parseDateString(s) !== null;
  };
  const dateParseable =
    nonNull.filter((s) => (DATE_SURFACE_REGEX.test(s) || isExcelSerial(s)) && parseDateString(s) !== null).length;
  const dateRatio = dateParseable / nonNullCount;
  const serialCount = nonNull.filter((s) => isExcelSerial(s)).length;
  const idPatternCount = nonNull.filter((s) => looksLikeId(s)).length;
  const idPatternRatio = idPatternCount / nonNullCount;

  // 电话 / 证件：强格式业务标识，独立于「唯一率」识别（脏表常缺值，唯一率不可靠）
  const hasPhoneName = hasNameHint(name, PHONE_NAME_HINTS);
  const hasCertName = hasNameHint(name, CERT_NAME_HINTS);
  const mobileCount = nonNull.filter((s) => CN_MOBILE_RE.test(s)).length;
  // 列名含电话语义词时才启用宽松形态（PHONE_LIKE_RE），避免长数字 ID 被误判为电话
  const phoneLikeCount = hasPhoneName
    ? nonNull.filter((s) => CN_MOBILE_RE.test(s) || PHONE_LIKE_RE.test(s)).length
    : mobileCount;
  const phoneRatio = phoneLikeCount / nonNullCount;
  // 强模式证件（身份证 18 位 / 护照字母+数字）无条件启用；弱形态仅在列名含证件语义时启用
  const certStrongCount = nonNull.filter(
    (s) => CN_ID_CARD_RE.test(s) || PASSPORT_LIKE_RE.test(s),
  ).length;
  const certCount = hasCertName
    ? nonNull.filter(
        (s) => CN_ID_CARD_RE.test(s) || PASSPORT_LIKE_RE.test(s) || CERT_NO_LOOSE_RE.test(s),
      ).length
    : certStrongCount;
  const certRatio = certCount / nonNullCount;

  let numericCount = 0;
  let pctCount = 0;
  let currencyCount = 0;
  for (const s of nonNull) {
    if (/%$/.test(s)) pctCount++;
    if (CURRENCY_REGEX.test(s) || (CHINESE_UNIT.test(s) && /^\d/.test(s))) currencyCount++;
    if (parseNumericString(s) !== null) numericCount++;
  }
  const numericRatio = numericCount / nonNullCount;

  const reasons: string[] = [];
  let inferredType: FieldType = "text";
  let confidence = 0.5;

  // 1) email：强值信号（纯正则，不可执行）
  if (emailRatio >= INFERENCE_THRESHOLDS.EMAIL_PARSE_RATIO) {
    inferredType = "email";
    confidence = 0.95;
    reasons.push(
      `值符合 email 形态比例 ${(emailRatio * 100).toFixed(0)}% ≥ 阈值 ${INFERENCE_THRESHOLDS.EMAIL_PARSE_RATIO * 100}%`,
    );
  }
  // 2) phone（强值信号：手机号；须先于 number，避免 11 位手机号被当整数）
  else if (
    phoneRatio >= INFERENCE_THRESHOLDS.PHONE_PARSE_RATIO ||
    (hasPhoneName && phoneRatio >= INFERENCE_THRESHOLDS.PHONE_NAME_MIN_RATIO)
  ) {
    inferredType = "phone";
    const byMobile = mobileCount / nonNullCount >= INFERENCE_THRESHOLDS.PHONE_PARSE_RATIO;
    confidence = byMobile ? 0.95 : 0.85;
    reasons.push(
      byMobile
        ? "值为中国大陆手机号形态（1[3-9] 开头 11 位）"
        : "列名含电话语义词，且值符合电话形态",
    );
    reasons.push(`值符合电话形态比例 ${(phoneRatio * 100).toFixed(0)}%`);
  }
  // 3) date（先于 id：避免 ISO 日期串「2024-08-01」因含分隔符被误判为 id）
  else if (
    dateRatio >= INFERENCE_THRESHOLDS.DATE_PARSE_RATIO ||
    (hasNameHint(name, DATE_NAME_HINTS) && dateRatio >= INFERENCE_THRESHOLDS.DATE_NAME_MIN_RATIO)
  ) {
    inferredType = "date";
    const mixedFormat = dateRatio < 1; // 部分值无法按表层日期格式解析（如 Excel 序列号）→ 混合格式
    confidence = mixedFormat ? 0.7 : 0.9;
    reasons.push(`可解析为日期比例 ${(dateRatio * 100).toFixed(0)}%`);
    if (mixedFormat) reasons.push("存在混合日期格式（部分值非标准日期串，低置信度标记）");
    if (serialCount > 0) reasons.push("检测到 Excel 序列号日期（如 45320 → 2024-01-29），已归一化为日期");
    if (hasNameHint(name, DATE_NAME_HINTS)) reasons.push("列名含日期语义词");
  }
  // 4) id：证件强模式 / 列名语义词 + 格式 / 值高唯一率 + 格式
  else if (
    certRatio >= INFERENCE_THRESHOLDS.CERT_PATTERN_RATIO ||
    (hasNameHint(name, ID_NAME_HINTS) &&
      idPatternRatio >= INFERENCE_THRESHOLDS.ID_NAME_PATTERN_RATIO &&
      nonNullCount >= INFERENCE_THRESHOLDS.ID_MIN_NONNULL) ||
    (uniqueRatio >= INFERENCE_THRESHOLDS.ID_UNIQUENESS_RATIO &&
      idPatternRatio >= INFERENCE_THRESHOLDS.ID_NAME_PATTERN_RATIO &&
      nonNullCount >= INFERENCE_THRESHOLDS.ID_MIN_NONNULL)
  ) {
    inferredType = "id";
    const byCert = certRatio >= INFERENCE_THRESHOLDS.CERT_PATTERN_RATIO;
    const byName = hasNameHint(name, ID_NAME_HINTS);
    confidence = byCert ? 0.95 : byName ? 0.92 : 0.85;
    if (byCert) {
      reasons.push(`值符合证件号强格式（身份证 18 位 / 护照字母+数字）比例 ${(certRatio * 100).toFixed(0)}%，按证件标识处理`);
    } else if (byName) {
      reasons.push("列名含 ID 语义词（订单号/单号/证件号/卡号等）");
    } else {
      reasons.push(`值唯一率 ${(uniqueRatio * 100).toFixed(0)}% ≥ 阈值 ${INFERENCE_THRESHOLDS.ID_UNIQUENESS_RATIO * 100}%`);
    }
    reasons.push(`唯一值 ${uniqueCount}/${nonNullCount}`);
    reasons.push(
      byCert
        ? `值符合证件格式比例 ${(certRatio * 100).toFixed(0)}%`
        : `值符合 ID 格式(字母数字/分隔符)比例 ${(idPatternRatio * 100).toFixed(0)}%`,
    );
    if (byName && !byCert && uniqueRatio < 1) {
      reasons.push(`唯一率 ${(uniqueRatio * 100).toFixed(0)}%（含重复，仍按列名语义判定 id）`);
    }
  }
  // 5) boolean
  else if (boolRatio >= INFERENCE_THRESHOLDS.BOOLEAN_RATIO) {
    inferredType = "boolean";
    confidence = 0.9;
    reasons.push(`布尔形态值比例 ${(boolRatio * 100).toFixed(0)}%`);
  }
  // 6) number / currency / percentage / integer / float
  else if (
    numericRatio >= INFERENCE_THRESHOLDS.NUMERIC_RATIO ||
    (hasNameHint(name, CURRENCY_NAME_HINTS) && numericRatio >= INFERENCE_THRESHOLDS.CURRENCY_NAME_MIN_RATIO)
  ) {
    const isPct = pctCount / nonNullCount > INFERENCE_THRESHOLDS.PERCENTAGE_COL_RATIO;
    const isCur = pctCount / nonNullCount <= INFERENCE_THRESHOLDS.PERCENTAGE_COL_RATIO &&
      (currencyCount / nonNullCount > INFERENCE_THRESHOLDS.PERCENTAGE_COL_RATIO || hasNameHint(name, CURRENCY_NAME_HINTS));
    if (isPct) {
      inferredType = "percentage";
      reasons.push("含百分号，判定为百分比");
    } else if (isCur) {
      inferredType = "currency";
      confidence = hasNameHint(name, CURRENCY_NAME_HINTS) ? 0.95 : 0.9;
      if (hasNameHint(name, CURRENCY_NAME_HINTS)) reasons.push("列名含金额/数值语义词");
      reasons.push(`含货币符号或中文单位比例 ${(currencyCount / nonNullCount * 100).toFixed(0)}%`);
    } else {
      const intCount = nonNull.filter((s) => {
        const num = parseNumericString(s);
        return num !== null && Number.isInteger(num);
      }).length;
      inferredType = intCount / numericCount > 0.9 ? "integer" : "float";
      reasons.push(`可解析为数值比例 ${(numericRatio * 100).toFixed(0)}%`);
      reasons.push(`${inferredType === "integer" ? "全整数" : "含小数"}`);
    }
    if (!isPct && !isCur) confidence = 0.85;
  }
  // 7) category：列名语义词，或 低唯一率（值重复率高）
  else if (
    hasNameHint(name, CATEGORY_NAME_HINTS) ||
    (uniqueRatio < INFERENCE_THRESHOLDS.CATEGORY_UNIQUE_RATIO && uniqueCount < INFERENCE_THRESHOLDS.CATEGORY_MAX_UNIQUE)
  ) {
    inferredType = "category";
    const byName = hasNameHint(name, CATEGORY_NAME_HINTS);
    confidence = byName ? 0.9 : 0.7;
    if (byName) reasons.push("列名含分类语义词（国家/渠道/状态/标签/广告组等）");
    else reasons.push(`唯一率 ${(uniqueRatio * 100).toFixed(0)}% < 阈值，且唯一数 ${uniqueCount} < ${INFERENCE_THRESHOLDS.CATEGORY_MAX_UNIQUE}，判定为分类维度`);
  }
  // 8) 姓名 / 名称：确定是文本（不是「拿不准」），高置信，不推给用户确认
  else if (hasNameHint(name, NAME_TEXT_HINTS)) {
    inferredType = "text";
    confidence = 0.9;
    reasons.push("列名含姓名/名称语义词，确定按文本处理");
  }
  // 9) text 回退
  else {
    inferredType = "text";
    confidence = 0.5;
    reasons.push("未满足更具体类型（id/phone/email/date/number/category）的阈值，回退为文本");
  }

  // 推断类型的可解析计数
  const parseableCount =
    inferredType === "email" ? emailCount
      : inferredType === "phone" ? phoneLikeCount
        : inferredType === "date" ? dateParseable
          : inferredType === "id"
            ? (certRatio >= INFERENCE_THRESHOLDS.CERT_PATTERN_RATIO ? certCount : idPatternCount)
            : inferredType === "boolean" ? boolCount
              : (inferredType === "integer" || inferredType === "float" || inferredType === "percentage" || inferredType === "currency")
                ? numericCount
                : nonNullCount;
  const invalidCount = nonNullCount - parseableCount;

  return {
    inferredType,
    confidence: Number(confidence.toFixed(2)),
    reasons,
    parseStats: {
      nonNullCount,
      parseableCount,
      uniqueCount,
      uniqueRatio: Number(uniqueRatio.toFixed(3)),
      invalidCount,
    },
  };
}

/**
 * 字段类型推断（兼容包装，保持原签名）：返回推断出的 FieldType。
 * 新代码请使用 inferColumnTypeDetailed 获取置信度与理由。
 */
export function inferColumnType(values: unknown[], name?: string): FieldType {
  return inferColumnTypeDetailed(values, name).inferredType;
}

/* ─────────────── Sheet 整合 ─────────────── */

/**
 * 清洗整个 sheet：
 *  - 表头识别：用 detectHeaderRow 在【表头+数据行合并】里重新打分（不信任 parser.headers，
 *    避免用户表的"说明/标题行"被误当表头），命中后从该行下方取数据。
 *  - 重复列名加序号 + 逐 cell 清洗 + 逐列类型推断
 *
 * 上游若有可信的 sheet.headers（如已人工标注），可显式传 options.headerIdx 跳过重测。
 */
export function cleanSheet(
  sheet: SheetInfo,
  options: { headerIdx?: number } = {},
): {
  cleanedHeaders: string[];
  cleanedRows: unknown[][];
  columnTypes: FieldType[];
} {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0) {
    return { cleanedHeaders: [], cleanedRows: [], columnTypes: [] };
  }

  // 把 parser 提取的 sheet.headers 放回第一行，让 detectHeaderRow 在完整数据上打分
  const allRows: unknown[][] = [
    ...(Array.isArray(sheet.headers) && sheet.headers.length > 0 ? [sheet.headers as unknown[]] : []),
    ...sheet.rows,
  ];

  // 表头行索引：默认重测；显式传 headerIdx 跳过
  const headerIdx = options.headerIdx ?? detectHeaderRow(allRows);
  const rawHeaders = allRows[headerIdx] || [];

  // 表头清洗：trim，空名兜底为 column_N
  let cleanedHeaders = rawHeaders.map((h, i) => {
    const s = String(h ?? "").trim();
    return s === "" ? `column_${i + 1}` : s;
  });

  // 重复列名加序号
  const seen = new Map<string, number>();
  cleanedHeaders = cleanedHeaders.map((h) => {
    const n = (seen.get(h) || 0) + 1;
    seen.set(h, n);
    return n > 1 ? `${h}_${n}` : h;
  });

  // 数据行（表头之后）
  const dataRows = allRows.slice(headerIdx + 1);

  // 收集每列值（用于类型推断）
  const colCount = cleanedHeaders.length;
  const columns: unknown[][] = Array.from({ length: colCount }, () => []);
  for (const row of dataRows) {
    for (let i = 0; i < colCount; i++) {
      columns[i].push(row[i] ?? null);
    }
  }

  // 逐列推断类型（T1-B：消费清洗前有效行 + 列名语义，保持 columnTypes: FieldType[] 兼容 EffectiveDataset）
  const columnTypes: FieldType[] = columns.map((colVals, i) => inferColumnType(colVals, cleanedHeaders[i]));

  // 逐 cell 清洗（按列类型优先解析）
  const cleanedRows = dataRows.map((row) =>
    Array.from({ length: colCount }, (_, i) => cleanCellValue(row[i], columnTypes[i])),
  );

  return { cleanedHeaders, cleanedRows, columnTypes };
}

/* ─────────────── EffectiveDataset 边界（T1-A） ─────────────── */

/**
 * 在 cleanSheet 之上产出 EffectiveDataset：parser / cleaner / profiler 之间
 * 唯一、可追踪的「有效数据集边界」。
 *
 * 设计铁律（T1-A → T1-C 演化）：
 *  - 不复制整行：rows 直接复用 cleanSheet 产出的引用，避免双倍内存；
 *  - 边界捕获与传递：T1-C 起在此处完成「有效行/列清理」并填充 excludedRows /
 *    excludedColumns / qualityIssues（T1-A 阶段这些字段预留为空，现已落地）；
 *  - 下游 profiler 必须消费本结构（或经 profileEffectiveDataset 适配器），
 *    不得从 raw 重建而丢失边界信息。
 *
 * 行/列排除规则（T1-C，非破坏性、可追溯，禁止删除真实业务数据）：
 *  - 排除行：结构性空行（全 null/空串/不可见空白/归一化空值词如 无/NA）。
 *    重复业务记录、部分字段为空的真实记录、未签收/退款/缺成本等业务异常行一律保留。
 *  - 排除列：无真实表头的 column_N 占位幽灵列（即使含稀疏值，因无业务语义）。
 *    合法但全空的业务字段（有真实表头）保留，供用户未来补充。
 *
 * @param options.headerIdx 显式表头行（跳过 detectHeaderRow 重测）；不传则由 cleanSheet 内部重测。
 */
export function buildEffectiveDataset(
  sheet: SheetInfo,
  options: { headerIdx?: number } = {},
): EffectiveDataset {
  // 复用 cleanSheet 已计算的表头行，避免重复打分导致边界不一致
  const headerIdx =
    options.headerIdx ??
    detectHeaderRow([
      ...(Array.isArray(sheet.headers) && sheet.headers.length > 0 ? [sheet.headers as unknown[]] : []),
      ...sheet.rows,
    ]);
  const cleaned = cleanSheet(sheet, { headerIdx });

  const hasParsedHeader = Array.isArray(sheet.headers) && sheet.headers.length > 0;
  // 原始行数 = 解析表头(若有) + 数据行；原始列数 = 解析表头与各数据行的最大宽度
  const rawRowCount = (hasParsedHeader ? 1 : 0) + sheet.rows.length;
  const rawColumnCount = Math.max(
    sheet.headers?.length ?? 0,
    ...sheet.rows.map((r) => r.length),
    0,
  );

  // ───────── T1-C：有效行清理（结构性空行 / 格式残留行） ─────────
  // dataRows（cleanSheet 的 cleanedRows）与 sheet.rows 在表头之下 1:1 对齐：
  // cleanSheet 的 dataRows = allRows.slice(headerIdx+1)，而 allRows = [headers, ...sheet.rows]。
  const excludedRows: ExcludedRow[] = [];
  const keptRowIdx: number[] = [];
  cleaned.cleanedRows.forEach((row, i) => {
    if (isStructurallyEmptyRow(row)) {
      excludedRows.push({
        rowIndex: i,
        reason: "空行/格式残留行（全部单元格为空或不可见空白）",
        preview: row.slice(0, 5).map((v) => (v == null ? null : String(v).slice(0, 24))),
      });
    } else {
      keptRowIdx.push(i);
    }
  });
  const effRows = keptRowIdx.map((i) => cleaned.cleanedRows[i]);

  // ───────── T1-C：有效列清理（无真实表头的 column_N 占位幽灵列） ─────────
  const excludedColumns: ExcludedColumn[] = [];
  const keptColIdx: number[] = [];
  cleaned.cleanedHeaders.forEach((h, i) => {
    const isPlaceholder = PLACEHOLDER_COLUMN_RE.test(String(h).trim());
    if (isPlaceholder) {
      // 计算该列在有效行中的非空值数（供审计；即使含稀疏值也排除，因无业务表头）
      let nn = 0;
      for (const r of effRows) {
        const v = r[i];
        if (v !== null && v !== undefined && String(v).trim() !== "") nn++;
      }
      excludedColumns.push({
        columnIndex: i,
        name: h,
        reason: nn === 0 ? "幽灵列（无表头占位 column_N 且全空）" : "幽灵列（无表头占位 column_N）",
        nonNullCount: nn,
      });
    } else {
      keptColIdx.push(i);
    }
  });

  // 重建有效 headers / rows / columns（只保留 kept 下标；幽灵列恒在末位，下标对齐保持）
  const headers = keptColIdx.map((i) => cleaned.cleanedHeaders[i]);
  const columns = keptColIdx.map((i) => cleaned.columnTypes[i]);
  const rows = effRows.map((r) => keptColIdx.map((i) => r[i] ?? null));

  const warnings: string[] = [];

  const ds: EffectiveDataset = {
    sheetId: sheet.name,
    sheetName: sheet.name,
    detectedHeaderRow: headerIdx,
    rawRowCount,
    rawColumnCount,
    effectiveRowCount: rows.length,
    effectiveColumnCount: headers.length,
    headers,
    rows,
    columns,
    excludedRows,
    excludedColumns,
    warnings,
  };

  // T1-C：结构化质量信号（与清洗解耦，只检测报告，绝不自动改写业务值）
  ds.qualityIssues = detectTableQualityIssues(sheet, ds);

  return ds;
}

/** 列名是否为占位名（cleanSheet 对空表头兜底为 column_N） */
const PLACEHOLDER_COLUMN_RE = /^column_\d+$/;

/**
 * 行是否为结构性空行：所有单元格为 null/undefined/空串/不可见空白，
 * 或归一化空值词（无/NA/null/暂无 等）。仅用于排除无效行，真实业务行（含部分空字段）保留。
 */
function isStructurallyEmptyRow(row: unknown[]): boolean {
  if (!row || row.length === 0) return true;
  return row.every((v) => {
    if (v === null || v === undefined) return true;
    const s = String(v).trim();
    if (s === "") return true;
    return NULL_LIKE_PATTERNS.test(s);
  });
}
