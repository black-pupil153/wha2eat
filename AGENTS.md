# AGENTS.md — 项目上下文与工作规则

> 你是本项目的开发协作者。**每次开始工作前，必须先读本文件**，再读与任务相关的 PRD.md 章节。
> 本文件与 PRD.md 共同构成项目事实源；代码与本文件冲突时，以本文件为准并报告。

## 项目一句话

「今晚吃什么」：打开就是今晚这道菜，一键开做（灶台模式）；背后是 HowToCook 底库规则选菜（急消耗 > 节气 > 复习 > 新菜）+ 一周菜单 + 采购清单 + 评分笔记进化（DeepSeek 按笔记修订做法）。产品初心 = 降低做菜的启动与过程成本；对外叙事仍是墨墨式复习 + 节气应季。外滩黑客松参赛作品，只做到 PRD 规定的范围。

## 事实源文件

- `PRD.md`：需求范围、数据模型、验收标准。**PRD §7「明确不做」里的事一律不做。**

## 不可变更（除非用户明确要求）

- 技术栈：Next.js (App Router) + TypeScript + Tailwind；状态用 React Context（`AppProvider`）；持久化只用 localStorage
- LLM：DeepSeek API（`deepseek-chat`），只允许在 `src/lib/llm.ts` 里调用，业务代码不得直接 fetch LLM
- 复习调度是纯函数，只在 `src/lib/review.ts`，不调用 LLM
- 不新增依赖，除非用户同意
- API key 只出现在 `.env.local`，绝不写进代码或提交

## 架构地图（改代码前先定位）

| 文件 | 职责 | 规则 |
|------|------|------|
| `src/lib/types.ts` | 数据模型**唯一定义** | 改类型必须同步检查所有引用；不得在其他文件重复定义 |
| `src/lib/llm.ts` | LLM 调用 + prompt + 返回校验 | 所有 prompt 修改只在这里；保持重试与 JSON 校验逻辑；LLM 只做补位与按笔记修订 |
| `src/lib/catalog.ts` | 底库规则选菜纯函数 | 只在服务端 API route 使用；打分权重见 PRD §5.2 |
| `src/data/catalog.json` | HowToCook 精选底库（124 道） | **不手改**，由 `scripts/build-catalog.mjs` 重新生成 |
| `src/lib/ingredients.ts` | 食材别名归一 + 冰箱匹配/扣减纯函数 | 所有食材名比对必须走 `canonicalFoodName`，不得裸字符串对比 |
| `src/lib/review.ts` | 复习调度纯函数 | 不掺 UI / storage 逻辑 |
| `src/lib/solar.ts` | 节气纯函数 | 不掺 UI / storage 逻辑 |
| `src/lib/shopping.ts` | 采购清单计算纯函数 | 数量加总、别名去重 |
| `src/lib/storage.ts` | localStorage 读写 | 所有持久化走这里，页面不直接碰 localStorage |
| `src/lib/constants.ts` | 常量与文案映射 | 新增枚举文案放这里 |
| `src/components/AppProvider.tsx` | 全局状态 + `completeCook`（做过了唯一落库入口） | 跨页共享的状态才进这里 |
| `src/components/CookDoneModal.tsx` | 「做过了」评分弹窗**唯一入口组件** | 新评分入口一律复用它，不得另写弹窗 |
| `src/app/*/page.tsx` | 页面 | 只做展示与交互，业务逻辑下沉到 lib；日期一律本地时区，禁用 toISOString 取日期 |

## 工作规则

1. **开工前**：读 PRD.md 中与本任务相关的章节 + `types.ts` 中相关类型
2. **改动涉及 3 个以上文件时**：先用不超过 10 行文字给出修改方案（改哪些文件、为什么），等用户确认再动手
3. **扩展优先于新建**：已有「做过了」按钮、库存扣减、?demo=1 等逻辑，一律在其上扩展，不得另起炉灶或重复实现
4. **完成后**：运行 `pnpm build`，有类型错误必须修完才算完成；M1–M3 既有功能（库存扣减、囤货标签、分享卡片、采购清单）不许降级
5. **收尾**：说明改动内容、验证方式（如 `pnpm build` 结果）与遗留问题
6. 发现 PRD 没有覆盖的情况：**停下来问用户**，不要自行发明需求
7. 回复用中文，代码注释保持现有风格（简洁中文注释）

## 当前进度

- M1–M3 已完成：骨架 + 菜单生成；采购闭环（勾选保留、联动更新、「做过了」扣减、「建议多买」囤货标签）；分享卡片 PNG、?demo=1、移动端 375px
- M4+M6 已完成：复习系统（墨墨式掌握度排期）+ 廿四节气应季
- **M7 已完成（PRD v3.0 体验重构）**：今晚优先 IA、灶台模式、HowToCook 底库规则选菜（秒出）、食材别名归一、CookDoneModal 唯一入口、Onboarding 两步、冰箱常备模板。选新菜调度优先级 **急消耗 > 节气 > 复习 > 新菜**；库内占槽仍是节气 > 复习到期
