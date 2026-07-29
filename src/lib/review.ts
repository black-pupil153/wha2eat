// 复习调度纯函数 —— 墨墨背单词式间隔复习核心逻辑

import type { CookRecord, Mastery, Rating, Dish, DueDish } from './types';

/**
 * 根据烹饪记录计算掌握度
 * - 做过 >= 4 次且最近 2 次评分都 >= 2 → 'mastered'
 * - 做过 >= 2 次 → 'familiar'
 * - 否则 → 'learning'
 */
export function getMastery(records: CookRecord[]): Mastery {
  if (records.length === 0) return 'learning';

  // 按日期降序排列，最近的在前
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length >= 4) {
    const recent2 = sorted.slice(0, 2);
    if (recent2.every((r) => r.rating >= 2)) {
      return 'mastered';
    }
  }

  if (sorted.length >= 2) return 'familiar';

  return 'learning';
}

/**
 * 根据掌握度和上次评分计算下次复习间隔天数
 */
export function getIntervalDays(mastery: Mastery, lastRating: Rating): number {
  // rating 1（踩雷）→ 无论掌握度都 2 天
  if (lastRating === 1) return 2;

  const table: Record<Mastery, Record<2 | 3, number>> = {
    mastered:  { 3: 14, 2: 7 },
    familiar:  { 3: 7,  2: 4 },
    learning:  { 3: 4,  2: 2 },
  };

  return table[mastery][lastRating];
}

/**
 * 找出所有到期待复习的菜
 * @param records 所有烹饪记录
 * @param library 菜谱库
 * @param today   当前日期 YYYY-MM-DD
 */
export function getDueDishes(
  records: CookRecord[],
  library: Dish[],
  today: string,
): DueDish[] {
  const dueMap = new Map<string, DueDish>();

  for (const dish of library) {
    // 找到该菜的所有记录，按日期降序
    const dishRecords = records
      .filter((r) => r.dishId === dish.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (dishRecords.length === 0) continue; // 没做过不在复习范围

    const latest = dishRecords[0];
    const mastery = getMastery(dishRecords);
    const interval = getIntervalDays(mastery, latest.rating);

    // 计算距上次做了多少天
    const daysSince = diffDays(latest.date, today);

    if (daysSince > interval) {
      dueMap.set(dish.id, {
        dishId: dish.id,
        dishName: dish.name,
        overdueDays: daysSince - interval,
        lastCookedDate: latest.date,
        mastery,
      });
    }
  }

  return Array.from(dueMap.values());
}

/**
 * 从到期菜中选择本轮复习菜
 * - 名额 = min(3, floor(cookDaysPerWeek / 2), due.length)
 * - 按 overdueDays 降序排列（最久没做的优先）
 */
export function selectReviewDishes(
  due: DueDish[],
  cookDaysPerWeek: number,
): DueDish[] {
  const slots = Math.min(3, Math.floor(cookDaysPerWeek / 2), due.length);

  return [...due]
    .sort((a, b) => b.overdueDays - a.overdueDays)
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
