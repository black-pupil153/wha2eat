# TASKS.md — Qoder 冲刺任务队列 v3（冲刺 → 8/5 包装死线）

> v3 说明（7/29 整体审阅后）：M1–M3 已完成但发现 2 个 bug + 1 个致命部署可达性问题；
> M4 复习系统 0% 开工。本队列 = 修复（T02–T05）→ M4 开发（T06–T16）→ 包装（T17–T18）→ 走查（T19）。
> 已拍板决策：品牌名统一「今晚吃什么」；评分+笔记入口 = /plan 页「做过了」按钮扩展弹窗（唯一入口）。

## 使用规则（先读完再开工）

1. **一个任务 = 一个新 Qoder 会话**，把任务框里的文字原样粘贴作为开场白
2. **严格按编号顺序执行**；每个任务结束后运行 `pnpm build`，绿了才进下一个
3. 每个任务完成后顺手 smoke 一遍 `?demo=1`——**M1–M3 已有功能不许降级**（库存扣减、囤货标签、分享卡片、采购清单）
4. 同一个任务修两次还不过：回滚该任务改动，跳过做下一个，把现象记下来
5. 200 次对话是预算不是目标；正常每个任务 3–10 次对话，预算充裕

---

## 第一阶段：修复存量问题（T02–T05，半天内）

### T01 现状审计
```
读 AGENTS.md、PRD.md §8。不要改任何代码。检查并输出（不超过 20 行）：
1) 复习系统相关代码是否已存在（预期：完全没有）；
2) 现有「做过了」按钮和库存扣减逻辑在哪些文件的哪些函数；
3) 现有 ?demo=1 逻辑在哪个文件；购物清单删除/重算逻辑在 shopping/page.tsx 的具体位置；
4) "吃一顿" 字样出现在哪些文件（品牌统一要用）；favicon 与 public/ 下脚手架文件清单；
5) pnpm build 是否通过。
```
- [x] 完成

### T02 修采购清单删除 bug + 数量加总
```
读 AGENTS.md、PRD.md §3.5。已知 bug：shopping/page.tsx 里 removeItem 删除某项后，
useEffect 的重算逻辑会把删掉的项目自动加回（删除永远留不住）。
任务：修复为"删除后不被加回"（如维护 deletedNames 集合并在重算时过滤）；
同时把同类食材合并时的数量从字符串拼接改为同单位数值加总（如 200g+300g=500g；
单位不同或无法解析时保留原样展示）。只改 shopping/page.tsx（必要时可新建 lib/shopping.ts 纯函数）。
完成后跑 pnpm build。
```
- [ ] 完成

### T03 修 ?demo=1 幂等
```
读 AGENTS.md、PRD.md §8 M5。已知 bug：?demo=1 在 localStorage 已有偏好时静默失效（旧数据不清、demo 数据不进）。
任务：?demo=1 时无论现有数据如何都进入演示态（覆盖写入 demo 数据后再跳转），重复触发结果一致。
只改 demo 逻辑所在文件（T01 报告有位置）。完成后跑 pnpm build，并用"先正常用一遍再开 ?demo=1"验证。
```
- [x] 完成

### T04 LLM 超时与错误兜底
```
读 AGENTS.md、PRD.md §6 通用要求。任务：lib/llm.ts 的 chat() 增加 60s AbortController 超时；
超时/接口错误/重试耗尽时抛出用户可读的错误信息；plan 页和 dish 页的生成按钮在失败时显示该信息
（不得静默或一直转圈）。只改 llm.ts 和两处页面按钮的错误展示。完成后跑 pnpm build。
```
- [x] 完成

### T05 品牌统一 + 清理
```
读 AGENTS.md、PRD.md §8 M5。任务：全项目"吃一顿"统一改为"今晚吃什么"（Nav、layout.tsx 的 title/metadata）；
删除 public/ 下脚手架 svg（next/vercel/globe/window/file）并替换 favicon 为简单文字或餐具 emoji 风格；
删除或从 lint 中排除 .vercel-tmp/ 目录。完成后跑 pnpm build 和 pnpm lint（lint 允许 warning，不允许 error）。
```
- [x] 完成

---

## 第二阶段：M4 复习系统（T06–T16，核心两天）

### T06 数据模型扩展
```
读 AGENTS.md、PRD.md §4。任务：types.ts 增加 Rating、Mastery、CookRecord、DueDish，
DayPlan 增加 kind?: 'new'|'review'；constants.ts 的 STORAGE_KEYS 增加 cookRecords 和 dishLibrary。
只改这两个文件，不动任何现有类型字段。完成后跑 pnpm build。
```
- [x] 完成

### T07 存储层扩展
```
读 AGENTS.md、PRD.md §4"菜谱库"段落。任务：storage.ts 增加 getCookRecords/addCookRecord、
getDishLibrary/upsertDish（按 id 覆盖写）；AppProvider.tsx 增加对应 state 和 action。
addCookRecord 要与现有「做过了」库存扣减逻辑协作（T01 报告有位置），不是重复实现。
每次生成新菜单时把新菜自动 upsert 进菜谱库。只改 storage.ts、AppProvider.tsx（及必要接线处）。
完成后跑 pnpm build。
```
- [x] 完成

### T08 复习调度纯函数（对齐 PRD §5）
```
读 AGENTS.md、PRD.md §5。任务：对齐 src/lib/review.ts——getMastery（≥3 次且最近评 3→mastered）、
getIntervalDays（learning3/familiar7/mastered21，踩雷一律2）、getDueDishes（到期用 ≥）、
selectLibrarySlots（名额 min(3,floor(天数/2),候选数)；候选=库内做过至少1次；排序 seasonScore 降序再 overdueDays 降序，未到期 overdueDays=-1）。
保留 selectReviewDishes 作别名。history 页改调 getMastery。纯函数，不碰 UI/storage。完成后跑 pnpm build。
```
- [x] 完成

### T08b 节气纯函数
```
读 AGENTS.md、PRD.md §5.1。任务：constants 增加廿四节气公历近似月日表；新建 src/lib/solar.ts，
实现 getSolarTerm(date)、getSolarWindow(date)（当前±1）、seasonScore(dish, window)（当前2/邻接1/否则0）。
纯函数。完成后跑 pnpm build。
```
- [x] 完成

### T08c Dish.solarTerms + LLM
```
读 AGENTS.md、PRD.md §4、§6.1。任务：types.ts Dish 增加 solarTerms: SolarTerm[]（旧数据缺省 []）；
llm.ts 生成周菜单/单菜注入节气窗文案，JSON 必出 solarTerms，校验容错。只改 types + llm（及必要校验）。
完成后跑 pnpm build。
```
- [x] 完成

### T09 课程表生成合并逻辑
```
读 AGENTS.md、PRD.md §6.1。任务：改 app/api/plan/route.ts——入参增加到期复习菜列表（含 Dish 快照），
LLM 只生成（做饭天数 − 复习数）道新菜；route 代码把复习菜与新菜按日期交替排入 DayPlan
（复习日 kind='review'），复习菜快照写入 WeekPlan.dishes。lib/llm.ts 生成数量改为参数。
只改这两个文件。完成后跑 pnpm build。
```
- [x] 完成

### T10 plan 页接通课程表 + 徽章
```
读 AGENTS.md、PRD.md §3.2、§5、§5.1。任务：/plan 生成菜单时用 solar 窗 + selectLibrarySlots（节气>到期）
从菜谱库取快照，随请求传给 /api/plan；渲染「新课/复习」徽章，命中节气窗另加「应季」；
复习菜下方显示上次改进要点（如有）。只改 src/app/plan/page.tsx。完成后跑 pnpm build + ?demo=1 smoke。
```
- [x] 完成

### T11 「做过了」弹窗：评分 + 笔记（唯一入口）
```
读 AGENTS.md、PRD.md §3.2、§3.3。任务：扩展 /plan 页现有「做过了」按钮（T01 报告有位置）：
点击后弹出评分（1 踩雷 / 2 一般 / 3 满意）+ 可选改进要点输入，提交调 addCookRecord，
库存扣减保持原有行为。这是全流程唯一入口，不要在 dish 页新增第二个"标记做过"按钮。
同时在 /dish/[id] 页增加：按时间倒序展示该菜全部历史笔记；菜品查询回退到菜谱库
（WeekPlan.dishes 找不到时查 dishLibrary）。只改 plan/page.tsx 和 dish/[id]/page.tsx。
完成后跑 pnpm build。
```
- [x] 完成

### T12 按改进要点重新生成做法
```
读 AGENTS.md、PRD.md §6.3。任务：lib/llm.ts 新增 reviseDish(dish, notes)（菜名身份不变，
按笔记修订用量/步骤/耗时，JSON schema 与 Dish 一致，id 由调用方保留，带 60s 超时与重试）；
新建 app/api/dish/revise/route.ts；/dish/[id] 加「按改进要点重新生成做法」按钮，
结果写回菜谱库并同步 WeekPlan 同 id 快照。只改这三个文件。完成后跑 pnpm build。
```
- [x] 完成

### T13 复习横幅
```
读 AGENTS.md、PRD.md §3.3。任务：/dish/[id] 对 kind='review' 的菜在顶部显示横幅
"上次你说：{最近一条改进要点}"，无笔记不显示。只改该页面。完成后跑 pnpm build。
```
- [x] 完成

### T14 换一道：复习分支
```
读 AGENTS.md、PRD.md §6.2。任务：/plan 页对复习菜的「换一道」改为从剩余到期复习菜取下一道
（不调 LLM，从菜谱库取快照）；无剩余到期菜时退化为现有新课换菜逻辑。联动重算采购清单。
只改 plan/page.tsx。完成后跑 pnpm build。
```
- [x] 完成

### T15 吃菜回溯页
```
读 AGENTS.md、PRD.md §3.6。任务：新建 /history 页——按菜聚合 CookRecord，每行显示菜名、做过次数、
上次日期、掌握度徽章（学习中/熟悉/拿手）、最近评分，点击跳 /dish/[id]（走菜谱库）；
顶部统计：累计做过 X 道、拿手 Y 道。Nav.tsx 加「回溯」入口。完成后跑 pnpm build。
```
- [x] 完成

### T16 demo 数据升级
```
读 AGENTS.md、PRD.md §8 M4 验收。任务：升级 ?demo=1 预置数据：新增两周 CookRecord 历史——
至少 2 道到期待复习（其中 1 道最近一次评分 1 踩雷且带改进笔记"盐减半"）、1 道 mastered 未到期；
对应 Dish 进菜谱库；保证 ?demo=1 后重新生成课程表能直接演示完整复习链路。保持 T03 的幂等性。
完成后跑 pnpm build + 全流程验证。
```
- [x] 完成

---

## 第三阶段：产品包装（T17–T18）

### T17 分享卡片美化
```
读 AGENTS.md、PRD.md §3.7。任务：重做 ShareCard——严格 3:4（内容溢出时压缩行高而不是撑高卡片）、
每天行内显示新课/复习徽章、底部加掌握度统计一行（如"拿手 3 道 · 学习中 5 道"）、
可选展示一句用户改进笔记、落款"今晚吃什么"。整体配色和留白达到小红书发布水准。
只改 ShareCard 相关文件。完成后跑 pnpm build，导出 PNG 检查比例和可读性。
```
- [x] 完成

### T18 README 重写
```
读 AGENTS.md、PRD.md §8 M5。任务：重写 README.md——产品名「今晚吃什么」、一句话定位
（墨墨背单词式做饭助手：新菜+复习+自动采购）、四大卖点、线上链接（先留占位符 __PROD_URL__）、
演示路径（?demo=1 六步动线）、技术栈、外滩黑客松 × Qoder 赛道信息。只改 README.md。
```
- [x] 完成

---

### T19 M4+M5 走查 + 回归
```
读 PRD.md §8 的 M4 和 M5 验收标准。不改代码。运行 pnpm build、pnpm lint、pnpm dev，
配合我逐条走查 M4 和 M5 全部验收项，并回归 M1–M3 既有功能（库存扣减、囤货标签、
分享卡片导出、采购清单删除/勾选）。输出逐项通过/失败清单。
```
- [ ] 完成

---

## 冲刺收尾（不在 Qoder 里做，主人亲自办）

- [ ] **今天**：官网报名页核实提交要求四件套（截止日/视频/源码/信息清单字段），填进 HACKATHON.md §1
- [ ] **今天**：决定国内可达方案（自有域名绑定 or 国内平台镜像），8/1 前上线
- [ ] git init 独立仓库（wha2eat 目前无版本控制），README 的 __PROD_URL__ 替换为真实国内可达链接
- [ ] Vercel 重新部署 + 国内可达镜像，线上验证 ?demo=1 复习链路
- [ ] 录 60 秒演示视频（70% 篇幅给复习链路：课程表徽章 → 复习横幅"上次你说：盐减半" → 按笔记重新生成 → 菜谱真的变了）
- [ ] 发小红书成品笔记（双话题 + 分享卡片图），回填链接提交作品
