// 食材名称归一化与冰箱匹配 —— 纯函数，不掺 UI / storage
// 解决「西红柿 ≠ 番茄」「蒜末 ≠ 大蒜」导致库存优先 / 扣减 / 采购过滤空转的问题

import type { Dish, FridgeItem, StockLevel } from './types';

/** 别名组：同组视为同一食材，首个为规范名 */
const ALIAS_GROUPS: string[][] = [
  ['西红柿', '番茄'],
  ['土豆', '马铃薯', '洋芋'],
  ['鸡蛋', '土鸡蛋', '草鸡蛋', '柴鸡蛋'],
  ['大蒜', '蒜', '蒜头', '独蒜'],
  ['生姜', '姜', '老姜', '嫩姜'],
  ['小葱', '葱', '香葱', '细香葱', '葱花'],
  ['青椒', '柿子椒', '菜椒', '灯笼椒'],
  ['花生', '花生米', '花生仁'],
  ['白萝卜', '萝卜'],
  ['大米', '米', '米饭', '剩米饭', '隔夜饭'],
  ['五花肉', '猪五花', '带皮五花肉'],
  ['猪里脊', '里脊', '里脊肉', '猪里脊肉'],
  ['香菇', '鲜香菇', '干香菇'],
  ['西兰花', '西蓝花'],
  ['面条', '挂面', '鲜面条'],
  ['豆腐', '嫩豆腐', '老豆腐', '北豆腐', '南豆腐'],
  ['鸡胸肉', '鸡胸', '鸡脯肉'],
];

const ALIAS_MAP = new Map<string, string>();
for (const group of ALIAS_GROUPS) {
  for (const name of group) ALIAS_MAP.set(name, group[0]);
}

/** 常见切法/形态后缀（不含「花」：菜花/桂花不是切法；葱花走 direct alias） */
const CUT_SUFFIX = /(末|沫|片|段|丝|丁|蓉|泥|碎|块|条|粒|瓣|汁|挽成结)+$/;

/**
 * 归一化食材名：去空白、剥切法后缀、查别名表。
 * 归一结果仅用于比对，不用于展示。
 */
export function canonicalFoodName(raw: string): string {
  let name = raw.trim().toLowerCase();
  // 常见误写
  if (name === '姜沫') name = '姜末';
  const direct = ALIAS_MAP.get(name);
  if (direct) return direct;
  const stripped = name.replace(CUT_SUFFIX, '');
  if (stripped.length >= 1 && stripped !== name) {
    name = stripped;
  }
  return ALIAS_MAP.get(name) ?? name;
}

/** 两个食材名是否指同一食材 */
export function sameFood(a: string, b: string): boolean {
  return canonicalFoodName(a) === canonicalFoodName(b);
}

/**
 * 菜谱侧合写 → 展开为可分别命中的规范名。
 * HowToCook 常见写法，否则冰箱有葱/姜/蒜却匹配不上。
 */
const COMPOUND_TO_CANONICAL: Record<string, string[]> = {
  葱姜: ['小葱', '生姜'],
  姜葱: ['小葱', '生姜'],
  葱蒜: ['小葱', '大蒜'],
  蒜葱: ['小葱', '大蒜'],
  姜蒜: ['生姜', '大蒜'],
  蒜姜: ['生姜', '大蒜'],
  葱姜蒜: ['小葱', '生姜', '大蒜'],
  姜葱蒜: ['小葱', '生姜', '大蒜'],
};

/** 食材名展开为用于比对的规范名集合（含合写展开） */
export function foodMatchKeys(raw: string): string[] {
  const trimmed = raw.trim();
  const compound = COMPOUND_TO_CANONICAL[trimmed] ?? COMPOUND_TO_CANONICAL[canonicalFoodName(trimmed)];
  if (compound) return compound;
  return [canonicalFoodName(trimmed)];
}

/** 一道菜命中的冰箱食材名（返回冰箱侧原名，展示用），瓶罐调味不参与 */
export function matchFridgeItems(dish: Dish, fridge: FridgeItem[]): string[] {
  const wanted = new Set<string>();
  for (const ing of dish.ingredients) {
    if (ing.category === '调味') continue;
    for (const key of foodMatchKeys(ing.name)) wanted.add(key);
  }
  return fridge
    .filter((f) => wanted.has(canonicalFoodName(f.name)))
    .map((f) => f.name);
}

/**
 * 「做过了」库存扣减：命中食材降一档（plenty→some→low→移除；expiring→移除）。
 * 瓶罐调味不扣减；沿用 M2 行为，仅把精确字符串匹配升级为别名匹配。
 */
export function deductFridge(fridge: FridgeItem[], dish: Dish): FridgeItem[] {
  const levelDown: Record<StockLevel, StockLevel | null> = {
    plenty: 'some',
    some: 'low',
    low: null,
    expiring: null,
  };
  const seasoning = new Set(
    dish.ingredients
      .filter((ing) => ing.category === '调味')
      .flatMap((ing) => foodMatchKeys(ing.name))
  );
  const used = new Set<string>();
  for (const ing of dish.ingredients) {
    if (ing.category === '调味') continue;
    for (const key of foodMatchKeys(ing.name)) used.add(key);
  }
  for (const name of dish.usesFridgeItems) {
    for (const key of foodMatchKeys(name)) {
      if (seasoning.has(key)) continue;
      used.add(key);
    }
  }

  const next: FridgeItem[] = [];
  for (const item of fridge) {
    if (used.has(canonicalFoodName(item.name))) {
      const down = levelDown[item.level];
      if (down) next.push({ ...item, level: down });
      // down 为 null 表示用完，移除
    } else {
      next.push(item);
    }
  }
  return next;
}

/**
 * 按人数换算用量：仅缩放「单一数字 + 单位」的干净格式（如 200g、2个），
 * 区间（10～12只）、公式、"适量" 原样保留，避免算错误导。
 */
export function scaleAmount(amount: string, factor: number): string {
  if (factor === 1) return amount;
  const m = amount.trim().match(/^(\d+(?:\.\d+)?)(\s*)([^\d]*)$/);
  if (!m) return amount;
  const scaled = parseFloat(m[1]) * factor;
  const rounded =
    scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 2) / 2;
  const num = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  const unit = m[3].trim();
  if (!unit) return num;
  // 保留原文数字与单位之间有无空格（"200g" vs "2 个"）
  return `${num}${m[2] || ''}${unit}`;
}
