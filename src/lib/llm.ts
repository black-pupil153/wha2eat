import type {
  Preferences,
  FridgeItem,
  Dish,
  Ingredient,
  IngredientCategory,
  Budget,
  LLMPlanResult,
  LLMAssignment,
  DueDish,
} from './types';
import { BUDGET_LABEL, STOCK_LEVEL_LABEL } from './constants';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';
// 初始 1 次 + 重试最多 2 次 = 最多 3 次尝试（PRD §M1）
const MAX_RETRIES = 2;
// 单次请求超时 60 秒
const REQUEST_TIMEOUT_MS = 60_000;

const VALID_BUDGET: Budget[] = ['low', 'mid', 'any'];
const VALID_CATEGORIES: IngredientCategory[] = [
  '蔬菜',
  '肉蛋',
  '调味',
  '主食',
  '其他',
];

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error(
      '未配置 DEEPSEEK_API_KEY，请在 .env.local 中设置后重启服务'
    );
  }
  return key;
}

function buildSystemPrompt(): string {
  return [
    '你是一名资深家常菜营养师，擅长根据用户偏好与冰箱库存规划一周晚餐菜单。',
    '请严格遵循以下规则：',
    '1. 忌口/过敏原是硬约束，绝不能在菜品中出现对应食材。',
    '2. 符合用户口味偏好与预算档。',
    '3. 优先消耗冰箱中"即将过期(expiring)"和"少(low)"的食材，并在 usesFridgeItems 里列出命中的食材名称。',
    '4. 一周内食材复用率尽量高，减少浪费，让采购清单更短。',
    '5. 不与近期吃过的菜名重复；一周内部菜品类型错开（荤素/口味/烹饪方式）。',
    '6. 工作日耗时 ≤ 30 分钟，周末可放宽至 60 分钟。',
    '7. 食材用量需按就餐人数换算。',
    '',
    '只返回合法 JSON，不要输出任何解释、Markdown 或多余文字。JSON 结构如下：',
    '{',
    '  "dishes": [',
    '    {',
    '      "id": "d1",',
    '      "name": "番茄炒蛋",',
    '      "description": "一句话描述",',
    '      "minutes": 20,',
    '      "costLevel": "low",',
    '      "ingredients": [{"name":"番茄","amount":"2个","category":"蔬菜"}],',
    '      "steps": ["步骤1","步骤2"],',
    '      "usesFridgeItems": ["番茄"]',
    '    }',
    '  ],',
    '  "assignments": [{"dayIndex": 0, "dishId": "d1"}]',
    '}',
    '',
    '约束：id 在 dishes 数组内唯一；dishId 必须能在 dishes 中找到；',
    'assignments 数量等于要求的做饭天数；dayIndex 从 0 开始递增；',
    'costLevel 只能是 low/mid/any；category 只能是 蔬菜/肉蛋/调味/主食/其他。',
  ].join('\n');
}

function buildPlanUserPrompt(
  prefs: Preferences,
  fridge: FridgeItem[],
  recentDishes: string[],
  newCount: number,
  reviewDishes: DueDish[],
  reviewNotes: Record<string, string>
): string {
  const fridgeText =
    fridge.length > 0
      ? fridge
          .map(
            (f) =>
              `${f.name}（${STOCK_LEVEL_LABEL[f.level] ?? f.level}）`
          )
          .join('、')
      : '空';
  const recentText =
    recentDishes.length > 0 ? recentDishes.join('、') : '无';

  // 复习菜信息（含上次改进要点）
  const reviewText =
    reviewDishes.length > 0
      ? reviewDishes
          .map((rd) => {
            const note = reviewNotes[rd.dishId];
            return note
              ? `${rd.dishName}（改进要点：${note}）`
              : rd.dishName;
          })
          .join('、')
      : '无';

  return [
    `就餐人数：${prefs.servings} 人`,
    `忌口/过敏原：${prefs.avoidances.length ? prefs.avoidances.join('、') : '无'}`,
    `口味偏好：${prefs.tastes.length ? prefs.tastes.join('、') : '无'}`,
    `预算档：${BUDGET_LABEL[prefs.budget] ?? prefs.budget}`,
    `本周做饭天数：${prefs.cookDaysPerWeek} 天`,
    `冰箱库存：${fridgeText}`,
    `近 2 周吃过的菜：${recentText}`,
    `本周复习菜（不要重复生成）：${reviewText}`,
    '',
    `请生成 ${newCount} 道新菜（复习菜已由系统安排，无需你处理），assignments 数量必须等于 ${newCount}。`,
    `新菜不得与复习菜（${reviewText}）同名。`,
  ].join('\n');
}

function buildDishUserPrompt(
  prefs: Preferences,
  fridge: FridgeItem[],
  excludeDishNames: string[]
): string {
  const fridgeText =
    fridge.length > 0
      ? fridge
          .map(
            (f) => `${f.name}（${STOCK_LEVEL_LABEL[f.level] ?? f.level}）`
          )
          .join('、')
      : '空';
  return [
    `就餐人数：${prefs.servings} 人`,
    `忌口/过敏原：${prefs.avoidances.length ? prefs.avoidances.join('、') : '无'}`,
    `口味偏好：${prefs.tastes.length ? prefs.tastes.join('、') : '无'}`,
    `预算档：${BUDGET_LABEL[prefs.budget] ?? prefs.budget}`,
    `冰箱库存：${fridgeText}`,
    `需要排除的菜名：${excludeDishNames.length ? excludeDishNames.join('、') : '无'}`,
    '',
    '请推荐 1 道符合约束的家常菜（工作日 ≤ 30 分钟），返回 JSON：',
    '{"dish":{"id":"d-new","name":"...","description":"...","minutes":25,"costLevel":"low","ingredients":[{"name":"...","amount":"...","category":"蔬菜"}],"steps":["..."],"usesFridgeItems":["..."]}}',
  ].join('\n');
}

interface RawDish {
  id?: string;
  name?: string;
  description?: string;
  minutes?: number;
  costLevel?: string;
  ingredients?: { name?: string; amount?: string; category?: string }[];
  steps?: string[];
  usesFridgeItems?: string[];
}

interface RawPlan {
  dishes?: RawDish[];
  assignments?: { dayIndex?: number; dishId?: string }[];
}

function normalizeBudget(v: unknown): Budget {
  return typeof v === 'string' && (VALID_BUDGET as string[]).includes(v)
    ? (v as Budget)
    : 'mid';
}

function normalizeCategory(v: unknown): IngredientCategory {
  return typeof v === 'string' &&
    (VALID_CATEGORIES as string[]).includes(v)
    ? (v as IngredientCategory)
    : '其他';
}

function normalizeDish(raw: RawDish, fallbackId: string): Dish {
  const id = (typeof raw.id === 'string' && raw.id.trim()) || fallbackId;
  const ingredients: Ingredient[] = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((ing) => ({
        name: typeof ing?.name === 'string' ? ing.name : '',
        amount: typeof ing?.amount === 'string' ? ing.amount : '适量',
        category: normalizeCategory(ing?.category),
      }))
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '未命名菜品',
    description: typeof raw.description === 'string' ? raw.description : '',
    minutes: typeof raw.minutes === 'number' ? raw.minutes : 30,
    costLevel: normalizeBudget(raw.costLevel),
    ingredients,
    steps,
    usesFridgeItems: Array.isArray(raw.usesFridgeItems)
      ? raw.usesFridgeItems.filter(
          (s): s is string => typeof s === 'string'
        )
      : [],
  };
}

function validatePlan(raw: RawPlan): LLMPlanResult {
  if (!raw || !Array.isArray(raw.dishes) || !Array.isArray(raw.assignments)) {
    throw new Error('返回结构缺少 dishes 或 assignments');
  }
  if (raw.dishes.length === 0) {
    throw new Error('返回的 dishes 为空');
  }
  const dishMap = new Map<string, Dish>();
  const dishes: Dish[] = raw.dishes.map((d, i) => {
    const dish = normalizeDish(d, `d${i + 1}`);
    if (dishMap.has(dish.id)) {
      // id 冲突时重命名
      dish.id = `${dish.id}-${i + 1}`;
    }
    dishMap.set(dish.id, dish);
    return dish;
  });
  const assignments: LLMAssignment[] = raw.assignments
    .map((a) => ({
      dayIndex: typeof a.dayIndex === 'number' ? a.dayIndex : -1,
      dishId: typeof a.dishId === 'string' ? a.dishId : '',
    }))
    .filter((a) => a.dayIndex >= 0 && dishMap.has(a.dishId));
  if (assignments.length === 0) {
    throw new Error('assignments 无法匹配到有效菜品');
  }
  return { dishes, assignments };
}

async function chat(messages: { role: string; content: string }[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI 响应超时（60 秒），请稍后重试');
    }
    throw new Error(
      `无法连接 AI 服务，请检查网络后重试${err instanceof Error ? `：${err.message}` : ''}`
    );
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DeepSeek 接口错误（${res.status}）：${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string =
    data?.choices?.[0]?.message?.content ?? '';
  return content;
}

/**
 * 生成一周菜单，非法 JSON / 结构校验失败时重试，最多 MAX_RETRIES 次。
 */
export async function generateWeekPlan(
  prefs: Preferences,
  fridge: FridgeItem[],
  recentDishes: string[],
  newCount: number,
  reviewDishes: DueDish[] = [],
  reviewNotes: Record<string, string> = {}
): Promise<LLMPlanResult> {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: buildPlanUserPrompt(prefs, fridge, recentDishes, newCount, reviewDishes, reviewNotes),
    },
  ];

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let content: string;
    try {
      content = await chat(messages);
    } catch (e) {
      // 网络/接口错误不重试，直接抛出
      throw e instanceof Error ? e : new Error('LLM 调用失败');
    }
    try {
      const parsed = JSON.parse(content) as RawPlan;
      return validatePlan(parsed);
    } catch (e) {
      lastError =
        e instanceof Error
          ? new Error(
              `LLM 返回非法 JSON（第 ${attempt + 1} 次尝试）：${e.message}`
            )
          : new Error('LLM 返回非法 JSON');
    }
  }
  throw lastError ?? new Error('LLM 多次返回非法 JSON');
}

/**
 * 生成单道菜（换一道），含同样的重试逻辑。
 */
export async function generateSingleDish(
  prefs: Preferences,
  fridge: FridgeItem[],
  excludeDishNames: string[]
): Promise<Dish> {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: buildDishUserPrompt(prefs, fridge, excludeDishNames),
    },
  ];

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let content: string;
    try {
      content = await chat(messages);
    } catch (e) {
      throw e instanceof Error ? e : new Error('LLM 调用失败');
    }
    try {
      const parsed = JSON.parse(content) as { dish?: RawDish };
      if (!parsed || !parsed.dish) {
        throw new Error('缺少 dish 字段');
      }
      return normalizeDish(parsed.dish, `d-${Date.now()}`);
    } catch (e) {
      lastError =
        e instanceof Error
          ? new Error(
              `LLM 返回非法 JSON（第 ${attempt + 1} 次尝试）：${e.message}`
            )
          : new Error('LLM 返回非法 JSON');
    }
  }
  throw lastError ?? new Error('LLM 多次返回非法 JSON');
}
