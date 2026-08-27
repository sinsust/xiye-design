import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// 本地：SQLite（better-sqlite3）。
// PHASE B（线上 Supabase）：另建 lib/db/schema.pg.ts 用 pg-core 镜像下表，
// 并在 lib/db/index.ts 按 DATABASE_URL 切换 postgres-js 驱动，schema 语义保持不变。

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  // 密码交由 Supabase Auth 托管；业务侧该列一般为空
  passwordHash: text("password_hash"),
  createdAt: integer("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // 整个 builder 工作区快照（flow-store + skeleton-store 的可序列化部分，JSON 字符串）
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 用户自定义「后宫智囊团」人设：每个 (user, role) 一行，覆盖默认专家名与头像。
export const agentSettings = sqliteTable(
  "agent_settings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    userRolePk: primaryKey({ columns: [t.userId, t.role] }),
  })
);

// 用户贡献的知识库条目：上传后进云端共享库（所有用户可见），并记录贡献人邮箱。
// stack / tags 以 JSON 字符串存列（跨 sqlite / pg 通用）。用户自建条目统一 userAdded=true，db 行都源于云端共享。
export const knowledgeEntries = sqliteTable("knowledge_entries", {
  slug: text("slug").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  useCase: text("use_case"),
  stack: text("stack"),
  tags: text("tags"),
  status: text("status"),
  updated: text("updated"),
  repoUrl: text("repo_url"),
  source: text("source"),
  contributorEmail: text("contributor_email"),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 用户绑定的腾讯 ima 知识库凭证（每用户一行，按 email 隔离）。
// imaApiKey 为 AES-256-GCM 加密后的密文，明文不出服务端、不落 log。
export const userImaConfig = sqliteTable("user_ima_config", {
  email: text("email").primaryKey(),
  imaClientId: text("ima_client_id").notNull(),
  imaApiKey: text("ima_api_key").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑：用户私有的个人知识笔记（随手记 + AI 自动整理）。
// 与知识库(共享技能库)不同，这里是个人私有、按 userId 隔离、随时间累积的笔记。
export const brainNotes = sqliteTable("brain_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 来源：text(粘贴/手输) / file(上传) / clip(剪藏) / voice(语音)
  source: text("source").notNull().default("text"),
  title: text("title"),
  // 原始正文，用户"只管往里扔"的未经整理内容
  content: text("content").notNull(),
  // AI 整理结果：分类 / 摘要 / 标签 / 关联建议（关联指向其他笔记 id 或标题）
  category: text("category"),
  summary: text("summary"),
  tags: text("tags"),
  related: text("related"),
  // 版本链：parentId 指向上一版本笔记(id)，null 表示初版；version 从 1 递增
  // 自引用 FK 由 lib/db/index.ts 的原始 DDL 补充（on delete set null）
  parentId: text("parent_id"),
  version: integer("version").notNull().default(1),
  // superseded：0=当前有效版本，1=已被更高版本取代（归档）
  superseded: integer("superseded").notNull().default(0),
  // 代码片段专用字段
  isSnippet: integer("is_snippet").notNull().default(0),
  // 编程语言（python/js/ts/sql/shell 等）
  language: text("language"),
  // 原始代码（不含解释），供高亮与一键复制
  codeContent: text("code_content"),
  // 语义向量（384 维 float 数组的 JSON 字符串）；null 表示未生成，检索降级为关键词
  embedding: text("embedding"),
  // ima 增量同步：来源文档唯一标识 + 最近一次同步时间
  imaDocId: text("ima_doc_id"),
  imaSyncedAt: text("ima_synced_at"),
  // AI 整理完整结构化结果（OrganizedNote 的 JSON 字符串）：参会人/指标/问题域/策略/重写正文等，
  // 与基础列(title/content/summary/tags)分开存，刷新不丢、可供详情页全可视化。
  struct: text("struct"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑：从笔记中 AI 提取的任务项，组成看板。按 userId 隔离，noteId 关联来源笔记。
export const brainTasks = sqliteTable("brain_tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("todo"),
  dueDate: text("due_date"),
  priority: text("priority").notNull().default("medium"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
  // 归档标记：笔记被复习后，其 done 任务自动归档（看板隐藏、库内保留）
  archived: integer("archived").notNull().default(0),
  // 关联策略（可选）：删除策略时置空，不删除任务
  strategyId: text("strategy_id").references(() => brainStrategies.id, {
    onDelete: "set null",
  }),
  // —— 第十阶段：结构化项目管理 ——
  // 归属项目（brain_projects.id）；删除/归档项目时置空（on delete set null）
  projectId: text("project_id").references(() => brainProjects.id, {
    onDelete: "set null",
  }),
  // 负责人（个人用标记角色："我" / "外包" / "合作方"…）
  assignee: text("assignee"),
  // 开始日期（ISO，YYYY-MM-DD）
  startDate: text("start_date"),
  // 里程碑名称（如"Q3 里程碑 1：完成调研"）
  milestone: text("milestone"),
  // 父任务 ID（子任务）：删除父任务时子任务悬浮为顶层（on delete set null）
  parentTaskId: text("parent_task_id"),
  // 排序权重（子任务排序用，小在前）
  sortOrder: integer("sort_order").notNull().default(0),
  // 预估 / 实际工时（小时）
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
});

// 第二大脑：从会议纪要等输入中 AI 拆解出的策略。按 userId 隔离，noteId 关联来源笔记。
// 一条策略可关联多个任务（brain_tasks.strategyId），构成「纪要 → 策略 → 任务」闭环。
export const brainStrategies = sqliteTable("brain_strategies", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 策略标题，如"Q3主攻东南亚市场"
  title: text("title").notNull(),
  description: text("description"),
  // active(活跃) / paused(暂停) / achieved(已达成) / abandoned(已放弃)
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑：间隔复习调度（艾宾浩斯遗忘曲线）。每条笔记一条"待复习"记录，复习后按 SM-2 生成下一条。
export const brainReviews = sqliteTable("brain_reviews", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 下次复习时间（ISO 字符串）
  nextReviewAt: text("next_review_at").notNull(),
  // 间隔天数（1→3→7→15→30→60…）
  interval: integer("interval").notNull(),
  // 熟练度系数（SM-2 ease factor），默认 2.5，上限 3.0
  easeFactor: real("ease_factor").notNull().default(2.5),
  // pending(待复习) / reviewed(已复习) / skipped(已跳过)
  status: text("status").notNull().default("pending"),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

// 用户的 UI 视觉偏好（主题明暗 + 配色预设/覆盖），登录后跨设备同步到服务端。
// custom 存 JSON 字符串：Record<presetId, PaletteOverride>。
export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("light"),
  activeStyleId: text("active_style_id").notNull().default("aw-brutalist"),
  custom: text("custom").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑 · 腾讯 ima 知识库增量同步日志：每次同步记录统计与状态。
// 供「最近同步时间 + 结果摘要」展示，不参与业务判定。
export const brainImaSyncLog = sqliteTable("brain_ima_sync_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 同步完成时间（ISO 字符串）
  syncedAt: text("synced_at").notNull(),
  total: integer("total").notNull().default(0),
  created: integer("created").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  // success / partial / failed
  status: text("status").notNull().default("success"),
  // 失败条目详情（JSON 数组，供展开查看）
  failures: text("failures").notNull().default("[]"),
});

// 第二大脑 · 收件箱：批量/零散输入的缓冲层。AI 先整理出 intent + 建议，写入此表 pending；
// 用户确认后才正式写入 brain_notes / brain_tasks，未确认不改库。按 userId 隔离。
export const brainInboxItems = sqliteTable("brain_inbox_items", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 原始输入内容（未经 AI 整理的原文）
  rawContent: text("raw_content").notNull(),
  // AI 识别意图：note / task / meeting / snippet / project / unknown
  intent: text("intent"),
  suggestedTitle: text("suggested_title"),
  suggestedCategory: text("suggested_category"),
  // AI 建议标签（JSON 数组字符串）
  suggestedTags: text("suggested_tags"),
  // AI 整理全量结果（OrganizedNote JSON），确认时据此落库
  organized: text("organized"),
  // 处理后关联的 brain_notes / brain_tasks ID
  noteId: text("note_id"),
  taskId: text("task_id"),
  // pending(待处理) / processing(AI处理中) / pending_confirmation(待确认) /
  // converted(已确认产出) / processed(旧数据已处理) / dismissed(已忽略) / failed(处理失败)
  status: text("status").notNull().default("pending"),
  // 时间戳（epoch ms，与其余 brain 表一致）
  createdAt: integer("created_at").notNull(),
  processedAt: integer("processed_at"),
  // —— P2-A 来源/产出链路：关联的处理计划与已产出对象 ——
  processingPlanId: text("processing_plan_id"),
  outputTaskIds: text("output_task_ids"),
  outputReminderIds: text("output_reminder_ids"),
  outputProjectId: text("output_project_id"),
  convertedAt: integer("converted_at"),
  failedReason: text("failed_reason"),
});

// 第二大脑 · 项目：结构化项目管理的顶层容器。按 userId 隔离。
// 任务通过 brain_tasks.projectId 关联到项目；状态 active/paused/completed/archived。
export const brainProjects = sqliteTable("brain_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // active(进行中) / paused(暂停) / completed(已完成) / archived(已归档-软删除)
  status: text("status").notNull().default("active"),
  // P3-A：项目优先级（用于工作台风险/下一步排序）与可编辑目标摘要（objective）。
  // objective 为 null 时空态展示 description 作为目标。
  priority: text("priority").notNull().default("medium"),
  objective: text("objective"),
  // 主题色（十六进制，进度条/看板/甘特图区分用）
  color: text("color").notNull().default("#3B82F6"),
  // 开始 / 截止日期（ISO，YYYY-MM-DD）
  startDate: text("start_date"),
  dueDate: text("due_date"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑 · 任务事件时间线：任务状态/子任务/截止日期等变更的自动日志。
// 只读、不可手动编辑，供任务详情页按时间回溯。
export const brainTaskTimeline = sqliteTable("brain_task_timeline", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => brainTasks.id, { onDelete: "cascade" }),
  // created / status_changed / comment_added / subtask_added / dueDate_changed
  action: text("action").notNull(),
  // 变更详情（JSON 字符串，如 {"from":"todo","to":"doing"}）
  detail: text("detail"),
  createdAt: integer("created_at").notNull(),
});

// 第二大脑 · 任务备注/评论：任务详情内的讨论区。
export const brainTaskComments = sqliteTable("brain_task_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => brainTasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

// —— 第十二阶段：提醒系统 ——
// 每用户每个提醒类型一行（8 种枚举），enabled 独立开关。
export const brainReminderRules = sqliteTable("brain_reminder_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // task_overdue / task_due_soon / review_due / inbox_backlog /
  // strategy_review / knowledge_decay / project_milestone / task_complete_followup
  type: text("type").notNull(),
  // 0=关闭 1=开启（默认全开）
  enabled: integer("enabled").notNull().default(1),
  // 提前多少分钟提醒（任务到期类）
  advanceMinutes: integer("advance_minutes"),
  // 免打扰时段（如 "22:00" ~ "08:00"），用户级设置，冗余存于各规则行，读取以任意行为准
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  createdAt: integer("created_at").notNull(),
});

// 提醒触达日志：每次触发写一条，同类型同一天去重；前端据此计数角标 + 标记已读。
export const brainReminderLog = sqliteTable("brain_reminder_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  // 0=未读 1=已读
  read: integer("read").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  readAt: integer("read_at"),
});

// —— P4 通知队列：统一的站内通知中心数据模型 ——
// 与 legacy brain_reminder_log（仅 read/log，驱动旧 ReminderCenter）并存；
// 本表承载完整状态机（new/read/deferred/snoozed/done/ignored）、可跳转对象、可解释原因、
// 稳定去重键、发送重试与用户隔离。站内通知中心以此表为唯一事实来源。
export const brainNotifications = sqliteTable("brain_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 触发类型：复用 ReminderType（task_overdue 等）+ proactive_suggestion / reminder_item
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  link: text("link"),
  // 可跳转真实对象：task/plan/project/note/inbox/review/milestone/strategy/reminder_item/generic
  refType: text("ref_type"),
  refId: text("ref_id"),
  // 可解释规则原因（"任务逾期：原定 2026-08-24 完成"），而非“AI 认为”
  reason: text("reason"),
  // new | read | deferred | snoozed | done | ignored
  status: text("status").notNull().default("new"),
  priority: text("priority").notNull().default("medium"),
  // 稳定去重键：同键同日内未终态则不重复入队
  dedupKey: text("dedup_key").notNull(),
  deliveredAt: integer("delivered_at"),
  snoozedUntil: integer("snoozed_until"),
  completedAt: integer("completed_at"),
  // 投递重试计数与最近一次错误
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// —— P0 统一信息加工确认闭环 ——
// 处理计划：任意输入经「AI 转译 → 用户编辑确认 → 统一写入」的持久化载体。
// AI 阶段只落 plan(pending_confirmation)，绝不直接建正式对象；确认后才 apply 批量写入。
export const brainProcessingPlans = sqliteTable("brain_processing_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 原始输入（未经整理）
  rawContent: text("raw_content").notNull(),
  // 输入类型：meeting/clip/jotting/markdown/snippet/task
  inputType: text("input_type"),
  // AI 建议的完整 ProcessingPlan（含标题/摘要/正文/实体/任务/提醒/项目/置信度/理由/证据等，JSON）
  planJson: text("plan_json").notNull(),
  // 用户确认时提交的编辑覆盖（标题/内容/分类/项目/行动项/提醒开关等，JSON）
  editsJson: text("edits_json"),
  // draft / pending_confirmation / applied / failed / rejected
  status: text("status").notNull().default("pending_confirmation"),
  // 来源入口：workbench / inbox / api…
  source: text("source").notNull().default("workbench"),
  // apply 成功后回填的产物 ID
  noteId: text("note_id"),
  taskIds: text("task_ids"),
  strategyIds: text("strategy_ids"),
  reminderIds: text("reminder_ids"),
  projectId: text("project_id"),
  // 写入失败的可读原因
  failureReason: text("failure_reason"),
  // 已部分写入对象与补偿/回滚信息（JSON），apply 中途失败时记录
  recovery: text("recovery"),
  createdAt: integer("created_at").notNull(),
  applyAt: integer("apply_at"),
  updatedAt: integer("updated_at").notNull(),
  // 软归档时间戳（升级清理策略用）；null = 未归档。归档≠删除，审计记录永久保留。
  archivedAt: integer("archived_at"),
});

// 用户确认创建的单条提醒（独立于规则推导型提醒）。
// 由 checkReminders 以 custom_reminder 类型接入提醒中心。
export const brainReminderItems = sqliteTable("brain_reminder_items", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // 触发时间（ISO）；按日期时可用 dueDate，触发时间可选
  remindAt: text("remind_at"),
  // 关联日期 YYYY-MM-DD
  dueDate: text("due_date"),
  noteId: text("note_id"),
  taskId: text("task_id"),
  planId: text("plan_id"),
  // 0=未完成 1=已完成
  done: integer("done").notNull().default(0),
  // pending / triggered / read
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
  readAt: integer("read_at"),
});

// 知识衰减：笔记被「查看/编辑/RAG 引用/复习」的访问流水，用于判定"最近 60 天是否被使用"。
export const brainNoteAccessLog = sqliteTable("brain_note_access_log", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  // view / edit / rag_reference / review
  accessType: text("access_type").notNull(),
  createdAt: integer("created_at").notNull(),
});

// —— P2-B 相似内容：检测候选 + 用户决策（绝不静默合并，仅记录决策与关系）——
export const brainSimilarPairs = sqliteTable("brain_similar_pairs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteIdA: text("note_id_a")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  noteIdB: text("note_id_b")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  // 相似度 0-1
  score: real("score").notNull(),
  // 检测方式：semantic(向量余弦) / keyword(关键词重叠)
  method: text("method").notNull().default("keyword"),
  // suggested(待处理) / related(标记相关) / independent(保留独立) / ignored(忽略)
  status: text("status").notNull().default("suggested"),
  createdAt: integer("created_at").notNull(),
  decidedAt: integer("decided_at"),
});

// —— P2-B 关系建议：AI/规则提出，用户确认或忽略（不建图，仅记录关系边）——
export const brainRelations = sqliteTable("brain_relations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 关系类型：derived_from(来源于) / belongs_to_project(属于项目) / produces_task(产生任务) /
  //            supports_conclusion(支持结论) / blocks_task(阻塞任务) / depends_on_task(依赖任务) /
  //            similar_to(与…相似) / may_conflict(可能冲突)
  type: text("type").notNull(),
  sourceId: text("source_id").notNull(),
  sourceType: text("source_type").notNull(),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull(),
  // 建议说明（AI 或规则生成的理由）
  note: text("note"),
  // suggested(待决策) / confirmed(已确认) / ignored(已忽略)
  status: text("status").notNull().default("suggested"),
  createdAt: integer("created_at").notNull(),
  decidedAt: integer("decided_at"),
});

// —— P2-B 过期整理审计：保留用户对「可能过期」笔记的每个决策 ——
export const brainCurationLog = sqliteTable("brain_curation_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  // not_updated(未更新) / not_referenced(未被引用)
  reason: text("reason").notNull(),
  thresholdDays: integer("threshold_days").notNull(),
  staleDays: integer("stale_days").notNull(),
  // keep(确认仍有效) / reorganize(重新整理) / archive(归档)
  action: text("action").notNull(),
  createdAt: integer("created_at").notNull(),
  decidedAt: integer("decided_at").notNull(),
});

// —— P3-B 任务结果沉淀 ——
// 重要任务完成后，用户以低成本留下「结果 / 经验 / 问题 / 后续方向」。
// 独立于原任务、原笔记与 ProcessingPlan；不直接生成下游任务、提醒或关系。
// status 枚举：
//   resolved    —— 已解决
//   partial     —— 部分完成
//   new_issue   —— 发现新问题（仅保存结果文本，是否继续整理由用户/前端决定）
//   no_record   —— 无需记录（一般不落库，仅作语义预留）
// projectId / noteId 必须与任务的既有归属一致（由读写层校验），可为空。
// idemKey 用于重复提交去重（任务 + 内容 + 时间窗口的可解释幂等策略）。
export const brainTaskOutcomes = sqliteTable("brain_task_outcomes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: text("task_id")
    .notNull()
    .references(() => brainTasks.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => brainProjects.id, {
    onDelete: "set null",
  }),
  noteId: text("note_id").references(() => brainNotes.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  detail: text("detail"),
  // 幂等去重键；同任务同状态同摘要同窗口视为重复提交
  idemKey: text("idem_key"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// —— P3-C：周报复盘（用户可保存每周一版；weekKey 幂等，覆盖旧值）——
export const brainWeeklyReviews = sqliteTable("brain_weekly_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 周键，如 "2026-W35"；同用户同周仅保留一版
  weekKey: text("week_key").notNull(),
  weekLabel: text("week_label").notNull(),
  periodStart: integer("period_start").notNull(),
  periodEnd: integer("period_end").notNull(),
  summary: text("summary").notNull(),
  // 完整复盘 JSON（完成/关键结果/风险/下周建议等），供恢复展示与历史回溯
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// —— P4-B：学习笔记复习闭环（独立于普通 SM-2 复习；stage 0→3 递进，间隔 1→7→21→30 天）——
// 复习状态是独立领域数据，通知只负责提醒；noteId 严格归属当前用户。
export const brainLearningReviews = sqliteTable("brain_learning_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  // 熟练阶段：0(新学) / 1 / 2 / 3(已掌握)
  stage: integer("stage").notNull().default(0),
  // 当前间隔天数（1→7→21→30）
  intervalDays: integer("interval_days").notNull(),
  // 下次复习时间（epoch ms）
  nextReviewAt: integer("next_review_at").notNull(),
  lastReviewedAt: integer("last_reviewed_at"),
  reviewCount: integer("review_count").notNull().default(0),
  // active(学习中) / mastered(已掌握) / paused(暂停)
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// —— P4-B：学习复习历史（可追溯每次复习动作：mastered / not_sure / snoozed / skipped）——
export const brainLearningReviewEvents = sqliteTable("brain_learning_review_events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewId: text("review_id")
    .notNull()
    .references(() => brainLearningReviews.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  reviewedAt: integer("reviewed_at").notNull(),
  // mastered / not_sure / snoozed / skipped
  action: text("action").notNull(),
  stageBefore: integer("stage_before").notNull(),
  stageAfter: integer("stage_after").notNull(),
  nextReviewAt: integer("next_review_at").notNull(),
});

// —— P4-C：主动风险简报（"今天值得关注"推送层）——
// 只消费既有真实数据、不调用 LLM；主动简报是独立于规则通知的"推送层"，
// 通过 brain_notifications（同一状态机）提醒，简报自身不落具体业务对象。
// brain_proactive_state：一天的简报项快照，用于 24h 去重 / 每日上限 / 用户控制动作状态；
// statement：同一 (userId, briefKey) 每天最多一条；跨天随窗口重置重新生成。
// actionStatus: null | tomorrow(明天提醒) | done(立即处理) | ignored(本周静默/忽略)
export const brainProactiveState = sqliteTable("brain_proactive_state", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 稳定去重键 = `${type}:${targetType}:${targetId}`
  briefKey: text("brief_key").notNull(),
  // proactive_<kind>（task/plan/project/inbox/note/review/week）
  type: text("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  severity: text("severity").notNull().default("medium"),
  score: real("score").notNull().default(0),
  reasonsJson: text("reasons_json").notNull().default("[]"),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  projectId: text("project_id").references(() => brainProjects.id, {
    onDelete: "set null",
  }),
  link: text("link").notNull(),
  primaryActionJson: text("primary_action_json").notNull().default("{}"),
  actionStatus: text("action_status"),
  createdAt: integer("created_at").notNull(),
});

// 本周不再提示 / 忽略范围偏好（作用域 type | object | project；按 weekKey 生效）
export const brainProactivePreferences = sqliteTable("brain_proactive_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // proactive_<kind>
  type: text("type").notNull(),
  // type | object | project
  scope: text("scope").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  projectId: text("project_id"),
  // 生效周（如 2026-W35）
  weekKey: text("week_key").notNull(),
  createdAt: integer("created_at").notNull(),
});

// 主动简报控制动作审计（立即处理 / 明天提醒 / 本周静默 / 忽略）
export const brainProactiveActions = sqliteTable("brain_proactive_actions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  briefId: text("brief_id"),
  // handle_now | tomorrow | silence_week | ignore
  action: text("action").notNull(),
  // type | object | project | none
  scope: text("scope").notNull(),
  briefType: text("brief_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  projectId: text("project_id"),
  createdAt: integer("created_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type AgentSettingRow = typeof agentSettings.$inferSelect;
export type KnowledgeEntryRow = typeof knowledgeEntries.$inferSelect;
export type BrainNoteRow = typeof brainNotes.$inferSelect;
export type BrainTaskRow = typeof brainTasks.$inferSelect;
export type BrainReviewRow = typeof brainReviews.$inferSelect;
export type BrainStrategyRow = typeof brainStrategies.$inferSelect;
export type UserPreferenceRow = typeof userPreferences.$inferSelect;
export type BrainImaSyncLogRow = typeof brainImaSyncLog.$inferSelect;
export type BrainInboxItemRow = typeof brainInboxItems.$inferSelect;
export type BrainProjectRow = typeof brainProjects.$inferSelect;
export type BrainTaskTimelineRow = typeof brainTaskTimeline.$inferSelect;
export type BrainTaskCommentRow = typeof brainTaskComments.$inferSelect;
export type BrainReminderRuleRow = typeof brainReminderRules.$inferSelect;
export type BrainReminderLogRow = typeof brainReminderLog.$inferSelect;
export type BrainNoteAccessLogRow = typeof brainNoteAccessLog.$inferSelect;
export type BrainProcessingPlanRow = typeof brainProcessingPlans.$inferSelect;
export type BrainReminderItemRow = typeof brainReminderItems.$inferSelect;
export type BrainSimilarPairRow = typeof brainSimilarPairs.$inferSelect;
export type BrainRelationRow = typeof brainRelations.$inferSelect;
export type BrainCurationLogRow = typeof brainCurationLog.$inferSelect;
export type BrainTaskOutcomeRow = typeof brainTaskOutcomes.$inferSelect;
export type BrainWeeklyReviewRow = typeof brainWeeklyReviews.$inferSelect;
export type BrainLearningReviewRow = typeof brainLearningReviews.$inferSelect;
export type BrainLearningReviewEventRow = typeof brainLearningReviewEvents.$inferSelect;
export type BrainProactiveStateRow = typeof brainProactiveState.$inferSelect;
export type BrainProactivePreferenceRow = typeof brainProactivePreferences.$inferSelect;
export type BrainProactiveActionRow = typeof brainProactiveActions.$inferSelect;
