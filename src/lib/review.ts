// 复习调度纯函数 —— 墨墨背单词式间隔复习 + 节气优先库内占槽（PRD §5）

import type { CookRecord, Mastery, Rating, Dish, DueDish } from './types';
import type { SolarWindow } from './solar';
import { seasonScore } from './solar';

/**
 * 根据烹饪记录计算掌握度（PRD §5）
 * - 做过 >= 3 次且最近一次评分 == 3 → 'mastered'
 * - 做过 >= 2 次 → 'familiar'
 * - 否则 → 'learning'
 */
export function getMastery(records: CookRecord[]): Mastery {
  if (records.length === 0) return 'learning';

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];

  if (sorted.length >= 3 && latest.rating === 3) {
    return 'mastered';
  }

  if (sorted.length >= 2) return 'familiar';

  return 'learning';
}

/**
 * 根据掌握度和上次评分计算下次复习间隔天数（PRD §5）
 * learning→3 / familiar→7 / mastered→21；踩雷(1)一律→2
 */
export function getIntervalDays(mastery: Mastery, lastRating: Rating): number {
  if (lastRating === 1) return 2;

  const table: Record<Mastery, number> = {
    learning: 3,
    familiar: 7,
    mastered: 21,
  };
  return table[mastery];
}

/**
 * 找出所有到期待复习的菜
 */
export function getDueDishes(
  records: CookRecord[],
  library: Dish[],
  today: string,
): DueDish[] {
  const due: DueDish[] = [];

  for (const dish of library) {
    const dishRecords = records
      .filter((r) => r.dishId === dish.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (dishRecords.length === 0) continue;

    const latest = dishRecords[0];
    const mastery = getMastery(dishRecords);
    const interval = getIntervalDays(mastery, latest.rating);
    const daysSince = diffDays(latest.date, today);

    // PRD：今天 − 上次 ≥ 间隔 即到期
    if (daysSince >= interval) {
      due.push({
        dishId: dish.id,
        dishName: dish.name,
        overdueDays: daysSince - interval,
        lastCookedDate: latest.date,
        mastery,
      });
    }
  }

  return due;
}

/**
 * 库内候选全量排序：节气匹配 > 复习到期（PRD §5）
 * 候选 = 菜谱库中至少做过 1 次的菜
 */
export function rankLibraryCandidates(
  records: CookRecord[],
  library: Dish[],
  today: string,
  window: SolarWindow,
): DueDish[] {
  const dueMap = new Map(
    getDueDishes(records, library, today).map((d) => [d.dishId, d]),
  );

  const candidates: DueDish[] = [];

  for (const dish of library) {
    const dishRecords = records
      .filter((r) => r.dishId === dish.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (dishRecords.length === 0) continue;

    const latest = dishRecords[0];
    const mastery = getMastery(dishRecords);
    const due = dueMap.get(dish.id);
    const score = seasonScore(dish, window);

    candidates.push({
      dishId: dish.id,
      dishName: dish.name,
      overdueDays: due ? due.overdueDays : -1,
      lastCookedDate: latest.date,
      mastery,
      seasonScore: score,
    });
  }

  return [...candidates].sort((a, b) => {
    const sa = a.seasonScore ?? 0;
    const sb = b.seasonScore ?? 0;
    if (sb !== sa) return sb - sa;
    return b.overdueDays - a.overdueDays;
  });
}

/**
 * 库内占槽
 * - 名额 = min(3, floor(cookDaysPerWeek / 2), 候选数)
 */
export function selectLibrarySlots(
  records: CookRecord[],
  library: Dish[],
  today: string,
  cookDaysPerWeek: number,
  window: SolarWindow,
): DueDish[] {
  const ranked = rankLibraryCandidates(records, library, today, window);
  const slots = Math.min(3, Math.floor(cookDaysPerWeek / 2), ranked.length);
  return ranked.slice(0, slots);
}

/** @deprecated 使用 selectLibrarySlots；保留别名兼容旧调用 */
export function selectReviewDishes(
  due: DueDish[],
  cookDaysPerWeek: number,
): DueDish[] {
  const slots = Math.min(3, Math.floor(cookDaysPerWeek / 2), due.length);
  return [...due]
    .sort((a, b) => {
      const sa = a.seasonScore ?? 0;
      const sb = b.seasonScore ?? 0;
      if (sb !== sa) return sb - sa;
      return b.overdueDays - a.overdueDays;
    })
    .slice(0, slots);
}

// ── 内部工具 ──

/** 计算 from 到 to 的天数差（to - from），基于本地日期字符串 */
function diffDays(from: string, to: string): number {
  const fromDate = new Date(from + 'T00:00:00');
  const toDate = new Date(to + 'T00:00:00');
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
