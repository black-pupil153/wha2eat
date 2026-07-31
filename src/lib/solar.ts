// 廿四节气纯函数 —— 公历近似月日表（PRD §5.1）

import type { Dish, SolarTerm } from './types';
import { SOLAR_TERM_APPROX } from './constants';

export interface SolarWindow {
  current: SolarTerm;
  prev: SolarTerm;
  next: SolarTerm;
}

/** 月日转一年中的序数（非闰年近似即可） */
function dayOfYear(month: number, day: number): number {
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = day;
  for (let m = 1; m < month; m++) n += daysInMonth[m];
  return n;
}

/**
 * 根据本地 YYYY-MM-DD 得到当前节气（公历近似）
 */
export function getSolarTerm(dateStr: string): SolarTerm {
  const parts = dateStr.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  const doy = dayOfYear(m, d);
  const terms = SOLAR_TERM_APPROX;

  // 取最后一个 startDoy <= doy 的节气；doy 小于小寒则属冬至段（跨年）
  let current: SolarTerm = terms[terms.length - 1].term;
  for (const t of terms) {
    if (t.startDoy <= doy) current = t.term;
    else break;
  }
  return current;
}

/** 传统节气环顺序（立春起），用于邻接 */
const SOLAR_RING: SolarTerm[] = [
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
  '小寒',
  '大寒',
];

export function getSolarWindow(dateStr: string): SolarWindow {
  const current = getSolarTerm(dateStr);
  const idx = SOLAR_RING.indexOf(current);
  const prev = SOLAR_RING[(idx - 1 + SOLAR_RING.length) % SOLAR_RING.length];
  const next = SOLAR_RING[(idx + 1) % SOLAR_RING.length];
  return { current, prev, next };
}

/**
 * 应季分：当前节气=2，邻接=1，否则=0；缺 solarTerms 视为 []
 */
export function seasonScore(dish: Dish, window: SolarWindow): number {
  const tags = dish.solarTerms ?? [];
  if (tags.includes(window.current)) return 2;
  if (tags.includes(window.prev) || tags.includes(window.next)) return 1;
  return 0;
}

export function isInSeason(dish: Dish, window: SolarWindow): boolean {
  return seasonScore(dish, window) >= 1;
}
