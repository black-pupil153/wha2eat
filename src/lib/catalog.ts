// HowToCook 精选底库（src/data/catalog.json，由 scripts/build-catalog.mjs 生成）
// 规则选菜纯函数：忌口硬过滤 → 节气/库存/口味打分 → 荤素错开贪心挑选。
// 只在服务端（API route）使用，不进客户端 bundle。

import rawCatalog from '@/data/catalog.json';
import type { Dish, Preferences, FridgeItem } from './types';
import type { SolarWindow } from './solar';
import { seasonScore } from './solar';
import { canonicalFoodName, matchFridgeItems, scaleAmount } from './ingredients';

/** 底库条目 = Dish + 构建期扩展字段 */
export interface CatalogDish extends Dish {
  tags: string[];
  catalogCategory: string;
}

const CATALOG: CatalogDish[] = (rawCatalog as unknown as CatalogDish[]).map((d) => ({
  ...d,
  source: 'howtocook',
}));

export function getCatalog(): CatalogDish[] {
  return CATALOG;
}

// ── 忌口关键词映射：偏好标签 → 命中即排除的食材/菜名关键词 ──
const AVOIDANCE_KEYWORDS: Record<string, string[]> = {
  // 忌口硬过滤：豆瓣酱（含郫县/红油）无法保证不辣 → 一律排除；花椒仅麻不单列
  辣: ['辣', '麻辣', '剁椒', '泡椒', '辣椒', '红油', '豆瓣酱', '麻婆', '水煮肉', '水煮鱼', '干煸'],
  香菜: ['香菜'],
  // 「蚝」覆盖蚝油；「鱼」覆盖鱼露；匹配前剥「鱼香」避免误杀无鱼菜
  海鲜: ['虾', '蟹', '鱼', '蛏', '蚝', '扇贝', '鱿鱼', '墨鱼', '海参', '鳕', '鲈', '鲤', '鳊', '桂鱼', '海带'],
  花生: ['花生'],
  乳制品: ['牛奶', '奶酪', '芝士', '黄油', '奶油', '炼乳'],
  麸质: ['面粉', '面条', '挂面', '吐司', '面包', '馒头', '饺子皮', '馄饨皮', '意面', '面筋'],
};

function violatesAvoidance(dish: CatalogDish, avoidances: string[]): boolean {
  if (avoidances.length === 0) return false;
  // 检查菜名 + 食材 name/amount（聚合残留也不可泄漏）；不查 steps/description 以免「可选不放」误杀
  // 「鱼香」无鱼，忌海鲜时先剥掉
  const text = (
    dish.name +
    ' ' +
    dish.ingredients.map((i) => `${i.name} ${i.amount ?? ''}`).join(' ')
  ).replace(/鱼香/g, '');
  for (const avoid of avoidances) {
    const keywords = AVOIDANCE_KEYWORDS[avoid] ?? [avoid];
    if (keywords.some((k) => text.includes(k))) return true;
  }
  return false;
}

// ── 主蛋白识别：用于一周荤素/蛋白错开 ──
const PROTEIN_GROUPS: [string, RegExp][] = [
  ['猪', /五花|里脊|猪|排骨|肘|培根|火腿|香肠|腊/],
  ['牛', /牛/],
  ['羊', /羊/],
  ['鸡鸭', /鸡|鸭/],
  ['鱼虾', /鱼|虾|蟹|蛏|蚝|扇贝|鱿|鳕|鲈|鲤|鳊/],
  ['蛋', /蛋/],
  ['豆制品', /豆腐|豆干|腐竹|千张|豆皮/],
];

function proteinOf(dish: CatalogDish): string {
  const text = dish.name + ' ' + dish.ingredients.map((i) => i.name).join(' ');
  for (const [group, re] of PROTEIN_GROUPS) {
    if (re.test(text)) return group;
  }
  return '素';
}

// ── 口味加分 ──
const TASTE_BONUS: Record<string, RegExp> = {
  清淡: /清蒸|蒸|凉拌|白灼|汤|粥|上汤|清炒/,
  重口: /红烧|烧|卤|焖|爆炒|干煸|孜然|椒盐/,
  酸甜: /糖醋|酸甜|咕噜|茄汁|酸汤|柠檬/,
  麻辣: /麻辣|麻婆|水煮|辣/,
};

export interface PickOptions {
  preferences: Preferences;
  fridge: FridgeItem[];
  /** 排除的菜名（近期吃过 + 本周已排 + 菜谱库同名） */
  excludeNames: string[];
  count: number;
  window: SolarWindow;
}

/**
 * 从底库按规则挑 count 道新菜。
 * 打分：急消耗 +8 > 应季×3 > 库存 +1 > 口味/快手 +1 > 预算超档 −2 + 随机抖动；
 * 贪心挑选时同主蛋白最多 2 道、同底库分类最多 3 道，保证一周吃得开。
 */
export function pickCatalogDishes(opts: PickOptions): Dish[] {
  const { preferences, fridge, excludeNames, count, window } = opts;
  if (count <= 0) return [];

  // 菜名排除用精确比对；canonicalFoodName 会剥「丁/丝/条」等切法后缀，不能用于菜名
  const excluded = new Set(
    excludeNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
  );
  const urgent = new Set(
    fridge
      .filter((f) => f.level === 'expiring' || f.level === 'low')
      .map((f) => canonicalFoodName(f.name))
  );
  const fridgeSet = new Set(fridge.map((f) => canonicalFoodName(f.name)));

  interface Scored {
    dish: CatalogDish;
    score: number;
    protein: string;
  }

  const candidates: Scored[] = [];
  for (const dish of CATALOG) {
    if (excluded.has(dish.name.trim().toLowerCase())) continue;
    if (violatesAvoidance(dish, preferences.avoidances)) continue;

    let score = seasonScore(dish, window) * 3;

    for (const ing of dish.ingredients) {
      if (ing.category === '调味') continue;
      const key = canonicalFoodName(ing.name);
      // 急消耗（即将过期/少）权重必须明确压过纯应季分（应季最高 6 + 快手 1）
      if (urgent.has(key)) score += 8;
      else if (fridgeSet.has(key)) score += 1;
    }

    for (const taste of preferences.tastes) {
      const re = TASTE_BONUS[taste];
      if (re && re.test(dish.name)) score += 1;
    }

    if (preferences.budget === 'low' && dish.costLevel === 'mid') score -= 2;
    if (dish.minutes <= 30) score += 1; // 快手菜整体优先

    score += Math.random(); // 抖动，避免每周一模一样

    candidates.push({ dish, score, protein: proteinOf(dish) });
  }

  candidates.sort((a, b) => b.score - a.score);

  // 贪心挑选 + 多样性约束
  const picked: CatalogDish[] = [];
  const proteinCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  const tryPick = (relaxed: boolean) => {
    for (const c of candidates) {
      if (picked.length >= count) break;
      if (picked.some((p) => p.id === c.dish.id)) continue;
      if (!relaxed) {
        if ((proteinCount.get(c.protein) ?? 0) >= 2) continue;
        if ((categoryCount.get(c.dish.catalogCategory) ?? 0) >= 3) continue;
      }
      picked.push(c.dish);
      proteinCount.set(c.protein, (proteinCount.get(c.protein) ?? 0) + 1);
      categoryCount.set(
        c.dish.catalogCategory,
        (categoryCount.get(c.dish.catalogCategory) ?? 0) + 1
      );
    }
  };
  tryPick(false);
  if (picked.length < count) tryPick(true); // 候选不足时放宽多样性约束

  // 输出：按人数换算用量 + 计算冰箱命中
  return picked.map((dish) => {
    const factor =
      preferences.servings / (dish.baseServings && dish.baseServings > 0 ? dish.baseServings : 2);
    return {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      minutes: dish.minutes,
      costLevel: dish.costLevel,
      ingredients: dish.ingredients.map((ing) => ({
        ...ing,
        amount: scaleAmount(ing.amount, factor),
      })),
      steps: dish.steps,
      usesFridgeItems: matchFridgeItems(dish, fridge),
      solarTerms: dish.solarTerms ?? [],
      baseServings: preferences.servings,
      source: 'howtocook' as const,
    };
  });
}
