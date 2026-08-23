// 产品方法论注入串：从知识库「技能」类 amp-*（craft-spec / jobs-to-be-done /
// prioritize / amazon-working-backwards）提炼的实操精华，供两条 PRD 生成路径
// （一句话 ai-intent-server + 多轮访谈 ai-discover-server）的 system prompt 复用。
// 知识库 .md 是完整可读来源（/library 可浏览深做），此处只取「让模型真正 Follow
// 的 operative 规则」，保证 token 可控且不与已移除的负向板块（非目标/风险/成功指标）冲突。

export const METHODOLOGY_INJECTION = `【产品方法论（来源：知识库「技能」类 amp-craft-spec / amp-jobs-to-be-done / amp-prioritize / amp-amazon-working-backwards；可在 /library 浏览深做）】
产出 PRD / 产品叙事时，必须应用以下经过验证的框架，杜绝通用套话：
1. 核心功能 = 第一优先级产出：coreModules 是整份 PRD 里最该被深挖的部分。每个模块必须包含：① 具体名称；② 它服务哪个用户任务（JTBD）；③ 一句可验收标准（做到什么算完成）。禁止只列名词。
2. JTBD（Jobs To Be Done）：写目标用户与核心功能时，挖到用户「雇」产品完成的 功能性 / 社交性 / 情感性 三类任务，并写明当前痛点 → 期望收益，让功能定义有动机支撑。
3. RICE 优先级：coreModules 按 (Reach×Impact×Confidence%)/Effort 排轻重，先排最重要的 3 个，明确哪些 defer。
4. craft-spec 结构：叙事须能撑起「问题陈述 → 方案概述 → 关键用户故事」骨架；每条都要是这个产品特有的、非显而易见的，敢指出漏洞与伪需求。
5. PR/FAQ（Working Backwards）：vision / positioning 用「客户视角新闻稿」式表达——先痛点后方案，一句话说清客户是谁、得到什么、why now。`;
