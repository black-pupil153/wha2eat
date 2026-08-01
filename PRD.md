# 今晚吃什么 — 产品需求文档 v3.0

> 用途：本文档是给 AI Coding Agent 的开发依据。
> Agent 开发原则：严格按本文档范围实现，不要自行扩展功能；每个里程碑完成后对照验收标准自检。
> v2 变更：新增"复习系统"（墨墨背单词式：每周新菜 + 复习旧菜 + 改进笔记回溯）。
> v2.1 变更（7/29 整体审阅后）：评分笔记入口定为 /plan 页「做过了」按钮扩展；新增 M5 修复与包装；LLM 增加超时要求；分享卡片规格升级。
> v2.2 变更（7/29）：新增廿四节气应季调度；库内占槽优先级 **节气 > 复习到期 > LLM 新菜**；M6 插入本冲刺与 M4 并行收尾。
> **v3.0 变更（8/1，M7 体验重构）**：对齐产品初心「降低做菜的启动与过程成本」——
> ① IA 改为**今晚优先**：/plan 首屏 = 今晚大卡片 +「开始做」主 CTA，周列表下沉；
> ② /dish 新增**灶台模式**（备菜清单 + 步骤逐条勾选 + 上次笔记 + 做完即评分）；
> ③ 数据源改为**权威底库 + LLM 编排**：内置 HowToCook 精选 156 道（`src/data/catalog.json`，Unlicense），
>    新菜由规则选菜秒出（忌口硬过滤 → 急消耗 > 应季 > 库存命中 > 口味），DeepSeek 只做候选不足补位与按笔记修订；
> ④ 食材**别名归一**（西红柿=番茄、蒜末=大蒜），库存优先/扣减/采购过滤真正生效；
> ⑤ 「做过了」唯一入口收敛为共享组件 `CookDoneModal` + `AppProvider.completeCook`，/plan 与灶台模式共用同一落库逻辑；
> ⑥ Onboarding 精简为「人数 + 忌口」两步，其余折叠可选；冰箱支持一键填入两人常备食材。
> 对外叙事不变（墨墨式复习 + 节气应季），复习/节气调度逻辑（§5、§5.1）不动。

## 1. 产品定位

解决做饭人群的三个核心痛点：
1. **每周/每天决定做什么菜**的决策负担；
2. **决定之后理不清要买什么菜**（以及冰箱已有食材该先消耗什么）；
3. **做过就忘**：想不起来以前吃过什么、哪道菜该练、上次哪里没做好。

一句话：输入偏好和冰箱库存 → AI 生成"一周课程表"（**应季菜优先** + 到期待复习旧菜 + 新菜）→ 一键合并出采购清单 → 做完记录评分和改进要点 → 下次复习时菜谱带着你的笔记进化。

类比：墨墨背单词，但背的是菜。差异点 = 决策 + 采购闭环 + **复习闭环** + **节气应季**。

**调度优先级（全局）**：节气匹配 > 复习到期 > 普通新菜（同档内再用 overdueDays）。

## 2. 技术栈（不可更改）

- Next.js（App Router）+ TypeScript + Tailwind CSS
- LLM：DeepSeek API，模型 `deepseek-chat`，通过 Next.js Route Handler（`app/api/`）调用，API key 放 `.env.local` 的 `DEEPSEEK_API_KEY`，绝不暴露到前端
- 数据持久化：浏览器 `localStorage`（不做账号体系、不做后端数据库）
- 分享卡片：客户端用 `html-to-image` 把菜单 DOM 导出为 PNG
- 部署：Vercel（需解决国内可达性，见 HACKATHON.md §0）

## 3. 页面与功能

### 3.1 偏好设置 `/onboarding`
- 字段：就餐人数（1-6）、忌口/过敏原（多选标签：辣/香菜/海鲜/花生/乳制品/麸质 + 自定义输入）、口味偏好（多选：清淡/重口/酸甜/麻辣）、每周做饭天数（3-7）、单餐预算档（省/适中/不限）
- 保存到 localStorage，之后可在设置页修改
- 首次访问 App 强制进入本页（各页面统一拦截，不允许绕过）

### 3.2 一周课程表 `/plan`（首页，v3 起「今晚优先」）
- **首屏 = 今晚大卡片**：今晚菜名 + 描述 + 耗时 + 消耗库存 + 上次笔记（如有）+ 徽章；主 CTA「开始做」进入灶台模式；次要操作：做过了 / 换一道 / 不想做
- 今晚已完成 / 外食 / 菜单不含今天，各有对应状态卡片
- 周列表下沉到「本周安排」（可折叠），保留原有换菜 / 外食 / 做过了操作
- 展示当前周菜单：按天排列，每天 1 道主菜（只做晚餐）
- 每道菜显示：菜名、一句话描述、耗时、成本档、用到的库存食材标记
- **课程标记**：每道菜带「新课」或「复习」徽章；若菜的 `solarTerms` 命中当前节气窗，另加「应季」徽章（可与新课/复习并存）；复习菜额外显示上次改进要点（如有）
- 操作：
  - 「重新生成」整周（库内占槽按 §5 重算，新菜重新生成）
  - 单道菜「换一道」（新课换新课；库内占槽菜按 §5 同序取下一道；无剩余则退化为新课）
  - 「不想做饭」切换当天为"外卖/外食"占位状态（仅标记，不做外卖推荐）
  - **「做过了」**：弹出评分（1 踩雷 / 2 一般 / 3 满意）+ 可选改进要点（如"盐减半"）→ 写入 CookRecord、DayPlan.isCooked 置 true、库存扣减（别名归一匹配）。**v3 起唯一入口 = 共享组件 `CookDoneModal` + `AppProvider.completeCook`**：/plan 列表与 /dish 灶台模式都从这一个组件/落库函数触发，不得另写第二套评分落库逻辑
- 生成与调度逻辑见 §5、§5.1、§6

### 3.3 菜谱详情 `/dish/[id]`
- **灶台模式（v3 新增）**：`?cook=1` 或点「开始做这道菜」进入——备菜清单逐项勾选、步骤逐条点完成（当前步高亮）、顶部「上次你说」横幅、底部固定「做完了，打个分」（弹出唯一入口 CookDoneModal，提交后回 /plan）
- 食材用量表（按就餐人数换算）、分步做法、耗时
- 菜谱来源：当周 WeekPlan.dishes；找不到时**回退查询菜谱库**（§4 dishLibrary）
- 展示该菜全部历史改进笔记（按时间倒序，数据来自 CookRecord）
- 复习菜显示横幅："上次你说：{最近一条 note}"
- 应季菜可展示所属节气标签
- 「按改进要点重新生成做法」按钮：调用 LLM，菜名不变，按全部笔记修订用量和步骤，写回菜谱库并同步当周快照（§6.3）；`solarTerms` 保留

### 3.4 冰箱库存 `/fridge`
- 增删改已有食材：名称 + 数量档（多/中/少/即将过期）
- 「即将过期」的食材在下次生成菜单时优先消耗

### 3.5 采购清单 `/shopping`
- 根据当前周菜单自动汇总：所有菜谱食材 − 冰箱库存 = 待购清单
- 同类食材合并、**数量真正加总**（同单位数值合并，不做字符串拼接）；按类别分组（蔬菜/肉蛋/调味/其他）
- 调味指瓶罐袋装调味料（酱油/盐/糖/油等），默认视为已有，不进入采购清单，也不参与「做过了」库存扣减；葱/姜/蒜等易腐鲜料按蔬菜管控（进采购、进冰箱、做菜扣减）
- 每项可手动勾选"已买"，勾选状态持久化
- 勾选已买同步写入冰箱（默认档「中」）；取消勾选若仍在清单则移出冰箱
- 可手动删除某项（如"家里其实还有"），**删除后不得被自动加回**

### 3.6 吃菜回溯 `/history`
- 列表：所有做过的菜，每行显示菜名、做过次数、上次做的日期、掌握度徽章（学习中/熟悉/拿手）、最近评分
- 点开进入对应 `/dish/[id]`（菜谱库查询）
- 顶部统计一行：累计做过 X 道菜、拿手 Y 道

### 3.7 分享卡片
- 在 `/plan` 页提供「生成菜单卡片」按钮
- 卡片内容：本周课程表（日期+菜名+**新课/复习/应季徽章**）+ 掌握度元素 + 可选一句用户改进笔记 + 产品名「今晚吃什么」
- **严格竖版 3:4**（内容不得溢出改变比例），排版达到小红书发布水准，导出 PNG 下载

## 4. 数据模型（TypeScript 类型）

```ts
type Budget = 'low' | 'mid' | 'any';
type StockLevel = 'plenty' | 'some' | 'low' | 'expiring';
type Rating = 1 | 2 | 3;                 // 1 踩雷 / 2 一般 / 3 满意
type Mastery = 'learning' | 'familiar' | 'mastered';

/** 廿四节气（中文名） */
type SolarTerm =
  | '立春' | '雨水' | '惊蛰' | '春分' | '清明' | '谷雨'
  | '立夏' | '小满' | '芒种' | '夏至' | '小暑' | '大暑'
  | '立秋' | '处暑' | '白露' | '秋分' | '寒露' | '霜降'
  | '立冬' | '小雪' | '大雪' | '冬至' | '小寒' | '大寒';

interface Preferences {
  servings: number;            // 1-6
  avoidances: string[];        // 忌口
  tastes: string[];            // 口味偏好
  cookDaysPerWeek: number;     // 3-7
  budget: Budget;
}

interface FridgeItem {
  id: string;
  name: string;
  level: StockLevel;
}

interface Ingredient {
  name: string;
  amount: string;              // 如 "200g"、"2个"
  category: '蔬菜' | '肉蛋' | '调味' | '主食' | '其他';
}

interface Dish {
  id: string;
  name: string;
  description: string;         // 一句话
  minutes: number;
  costLevel: Budget;
  ingredients: Ingredient[];
  steps: string[];
  usesFridgeItems: string[];   // 命中的库存食材名
  solarTerms: SolarTerm[];     // 所属节气；旧数据缺省视为 []
}

interface DayPlan {
  date: string;                // ISO YYYY-MM-DD
  dishId: string | null;       // null 表示"不想做饭"
  isTakeout: boolean;
  isCooked?: boolean;          // 标记"做过了"
  kind?: 'new' | 'review';     // 新课 / 复习课（应季用徽章展示，不新增 kind）
}

interface WeekPlan {
  id: string;
  createdAt: string;
  days: DayPlan[];
  dishes: Record<string, Dish>;
}

interface ShoppingItem {
  name: string;
  amount: string;
  category: Ingredient['category'];
  checked: boolean;
  suggestExtra?: string;
}

// —— 复习系统 ——

interface CookRecord {
  id: string;
  dishId: string;
  dishName: string;            // 冗余存储，防止菜谱库条目变动后丢失
  date: string;                // YYYY-MM-DD 本地时区
  rating: Rating;
  notes?: string;              // 改进要点
  createdAt: string;           // ISO timestamp
}

// 复习调度 / 库内占槽结果（lib/review.ts 输出，不落盘）
interface DueDish {
  dishId: string;
  dishName: string;
  overdueDays: number;         // 超过复习间隔的天数；未到期候选为 -1
  lastCookedDate: string;      // YYYY-MM-DD
  mastery: Mastery;
  seasonScore?: number;        // 0/1/2，见 §5.1
}
```

**菜谱库**：`dishLibrary` 存 localStorage（实现可为数组，按 id upsert）。所有生成过的 Dish 一律入库；WeekPlan.dishes 保持现状（当周快照），回溯/复习查询走菜谱库。

## 5. 复习调度逻辑（`src/lib/review.ts`，纯函数，不用 LLM）

- **掌握度**（由某菜全部 CookRecord 推导）：
  - `mastered`：做过 ≥ 3 次且最近一次评分 3
  - `familiar`：做过 ≥ 2 次（不满足 mastered）
  - `learning`：其余（含最近评分 1）
- **复习间隔**：learning → 3 天；familiar → 7 天；mastered → 21 天；最近一次评分 1（踩雷）无论掌握度 → 2 天
- **到期判定**：`今天 − 上次 date ≥ 间隔` 即到期；`overdueDays` 为超出天数（`daysSince - interval`，恰好到期时为 0）
- **库内占槽**（原「每周复习名额」，函数名 `selectLibrarySlots`；可保留 `selectReviewDishes` 作别名）：
  - 名额 = `min(3, floor(cookDaysPerWeek / 2), 候选数)`
  - 候选 = 菜谱库中**至少做过 1 次**的菜（含到期与未到期）
  - 排序键：① `seasonScore` 降序；② 同档内 `overdueDays` 降序（未到期记 -1）
  - 效果：**应季未到期可挤掉过季已到期**；过季到期仍可入选但排在应季之后
- 例：每周做 5 天 → 最多 2 个库内占槽 + 3 新课；历史为空时全部为新菜
- 日期比较用本地时区的 YYYY-MM-DD，不用 toISOString（UTC 偏移会把"今天"算错）

### 5.1 节气窗（`src/lib/solar.ts`，纯函数，不用 LLM）

- 廿四节气用**固定公历近似月日表**（无天文推算依赖；与真实农历节气可差几天，可接受）
- `getSolarTerm(date: YYYY-MM-DD)` → 当前节气
- `getSolarWindow(date)` → `{ current, prev, next }`（当前 ±1 邻接）
- `seasonScore(dish, window)`：
  - 菜的 `solarTerms` 含 `current` → 2
  - 否则含 `prev` 或 `next` → 1
  - 否则（含 `solarTerms` 缺失/空）→ 0
- UI「应季」徽章：`seasonScore >= 1`

**验收举例**：
- 大暑附近：库内「凉拌苦瓜」挂大暑且未到期 + 「红烧肉」过季但 overdue 10 天 → **先占苦瓜**
- 两者都过季、仅红烧肉到期 → 仍复习红烧肉
- 库内无候选 → 全员 LLM 新菜，且偏应季

## 5.2 底库规则选菜（v3 新增，`lib/catalog.ts`，纯函数，不用 LLM）

- 数据源：`src/data/catalog.json`——HowToCook 精选 156 道晚餐菜（Unlicense 许可，可合法内置），由 `scripts/build-catalog.mjs` 生成（过滤早餐/甜品/饮品/设备依赖菜，食材自动分类，节气标签按时令食材关键词映射）
- 新菜选取：忌口硬过滤（含调味料，如蚝油触发海鲜忌口）→ 打分排序 → 贪心挑选
- 打分：急消耗食材（expiring/low）命中 +8/个 > 应季（seasonScore×3，最高 6）> 普通库存命中 +1/个 > 口味匹配 +1 > 快手（≤30min）+1 > 预算超档 −2 > 随机抖动
- 多样性：同主蛋白（猪/牛/鸡鸭/鱼虾/蛋/豆制品）最多 2 道、同底库分类最多 3 道；候选不足时放宽
- 用量按人数换算（仅缩放"单一数字+单位"格式，区间/公式原样保留）；`usesFridgeItems` 用别名归一匹配（`lib/ingredients.ts`）
- 周末槽位优先分配耗时长的新菜

## 6. LLM 生成逻辑（`app/api/plan/route.ts`、`lib/llm.ts`）

**通用要求**：所有 LLM 调用带 60s 超时（AbortController）；超时/接口错误/非法 JSON 都要给前端可理解的错误信息，不得静默或白屏；非法 JSON 重试最多 2 次。
**v3 定位**：LLM 从「菜单生成器」退为「补位与进化器」——① 底库候选不足（重忌口）时补新菜；② 按笔记修订做法（§6.3，核心卖点）；③ steps 质量要求：第一步备菜汇总，每步含火候/时长，5-10 步。

### 6.1 一周课程表
- 库内占槽菜由 §5 / §5.1 纯函数预先选定，**不让 LLM 决定占哪几道库内菜**
- 新菜默认由 §5.2 底库规则选菜秒出；**仅当底库候选 < 所需新菜数时**，LLM 补齐缺口：排除 recentDishes（近 40 条）与已选菜名，遵守忌口（硬约束）、口味、预算、库存优先消耗、周内菜品类型错开、工作日 ≤ 30 分钟；**硬约束优先当前/邻接节气食材与菜式**；每道菜必须输出 `solarTerms`
- LLM 输出严格 JSON（`response_format: json_object`）：`{ dishes: Dish[], assignments: { dayIndex, dishId }[] }`
- **合并由 route handler 代码完成**：新菜与库内占槽按日期交替穿插排入 DayPlan（复习占偶数槽，周末槽优先放耗时长的新菜）；库内占槽日 `kind='review'`（含应季未到期挤占的情况，仍用复习 kind + 应季徽章区分）；日期一律用本地时区 YYYY-MM-DD（不用 toISOString）

### 6.2 换一道
- 新课：默认走 §5.2 底库规则秒出（`/api/dish` quick 模式）；底库无候选时落到 generateSingleDish（LLM），排除当周已有菜名与近期吃过；注入节气窗，输出 `solarTerms`
- 库内占槽课：从剩余候选按 §5 同序取下一道，不调用 LLM；无剩余则退化为新课

### 6.3 按改进要点重新生成做法（`lib/llm.ts` 的 `reviseDish`）
- 输入：现有 Dish + 该菜全部 note 列表
- Prompt 要点：菜名和菜品身份不变；按笔记修订用量/步骤/耗时；保持 JSON schema 与 Dish 一致；id 与 `solarTerms` 由调用方保留
- 输出写回菜谱库；WeekPlan 中同 id 快照同步更新

## 7. 明确不做（Out of Scope）

- 账号系统、多端同步
- 外卖商家数据接入、真实电商下单
- 早餐/午餐规划
- 营养成分计算
- 拍照识别食材（后续版本候选）
- 复杂遗忘曲线算法（SM-2 等）、自定义复习间隔（先用 §5 的固定三档）
- **天文年节气精确推算**、用户自定义节气表
- 精确到克的库存扣减 / 调味不管控 / AI 硬件识冰箱（赛后备用，见 HACKATHON §0）

## 8. 里程碑与验收标准

### M1：骨架 + 菜单生成（已完成 7/22）
### M2：采购闭环（已完成 7/23，含「做过了」库存扣减、「建议多买」囤货标签）
### M3：传播与打磨（已完成 7/23：分享卡片 PNG、`?demo=1`、移动端 375px、部署）

### M4：复习系统（冲刺核心）
- [ ] types/storage 增加 CookRecord 与 dishLibrary，已有 localStorage 数据不丢
- [ ] `lib/review.ts` 掌握度/间隔/到期计算正确（手动验证：无记录、踩雷、mastered 未到期三种情况）
- [ ] `/plan` 页「做过了」按钮扩展评分 + 改进笔记弹窗（唯一入口，无第二个重复按钮）；库存扣减保持原行为
- [ ] `/dish/[id]` 展示笔记历史、复习横幅，并支持菜谱库回退查询
- [ ] `/plan` 生成课程表：新菜 + 库内占槽交替穿插，「新课/复习」徽章与上次笔记显示正确
- [ ] `/history` 列表与统计正确，点击可跳转菜谱库中的菜品
- [ ] 「按改进要点重新生成做法」产出修订版菜谱，写回菜谱库并同步当周快照
- [ ] 「换一道」库内分支：按 §5 同序取下一道（不调 LLM），无剩余退化为新课
- [ ] `?demo=1` 升级：预置数据含两周 CookRecord 历史（至少 2 道到期待复习、其中 1 道踩雷带笔记、1 道 mastered 未到期），能直接演示完整复习链路

### M5：修复与产品包装
- [ ] 采购清单「删除某项」修复（删除后不被自动加回）；同类食材数量真正加总（同单位数值合并）
- [ ] `?demo=1` 幂等：无论 localStorage 是否有旧数据都能进入演示态
- [ ] LLM 调用 60s 超时 + 友好错误提示
- [ ] 品牌统一为「今晚吃什么」（Nav、浏览器 title、favicon；清理 public/ 脚手架 svg）
- [ ] 分享卡片：严格 3:4、含新课/复习/应季徽章与掌握度元素，排版达到小红书发布水准
- [ ] README 重写：产品介绍 + 线上链接 + 演示路径（?demo=1）+ 赛道信息（外滩黑客松 × Qoder）
- [ ] 线上链接国内可达（自定义域名或国内镜像）
- [ ] 回归：M1–M3 既有功能（库存扣减、囤货标签、分享卡片、采购清单）全部不降级；`pnpm build` 绿

### M6：节气应季（插入本冲刺，与 M4 并行收尾）
- [ ] `Dish.solarTerms` + `lib/solar.ts` 节气窗 / seasonScore 正确
- [ ] `selectLibrarySlots`：应季未到期可压过过季已到期（验收举例见 §5.1）
- [ ] LLM 新菜注入节气窗并输出 `solarTerms`；旧菜缺字段视为 []
- [ ] `/plan` 显示「应季」徽章；换一道库内分支同序
- [ ] `?demo=1` 预置菜含节气标签，能演示应季优先

## 9. 开发约定

- 每个里程碑完成后运行 `pnpm build` 确认无类型错误
- 组件用函数组件 + hooks；状态管理用 React Context（AppProvider）
- 所有 LLM 调用封装在 `lib/llm.ts`，业务代码不直接碰 fetch
- 复习调度纯函数全部放 `lib/review.ts`；节气纯函数全部放 `lib/solar.ts`，不掺 UI 逻辑
