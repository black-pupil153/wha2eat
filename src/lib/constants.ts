import type { Budget, StockLevel, IngredientCategory, SolarTerm } from './types';

export const AVOIDANCE_OPTIONS = ['辣', '香菜', '海鲜', '花生', '乳制品', '麸质'];

export const TASTE_OPTIONS = ['清淡', '重口', '酸甜', '麻辣'];

export const BUDGET_OPTIONS: { value: Budget; label: string }[] = [
  { value: 'low', label: '省' },
  { value: 'mid', label: '适中' },
  { value: 'any', label: '不限' },
];

export const BUDGET_LABEL: Record<Budget, string> = {
  low: '省',
  mid: '适中',
  any: '不限',
};

export const STOCK_LEVEL_OPTIONS: { value: StockLevel; label: string }[] = [
  { value: 'plenty', label: '多' },
  { value: 'some', label: '中' },
  { value: 'low', label: '少' },
  { value: 'expiring', label: '即将过期' },
];

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  plenty: '多',
  some: '中',
  low: '少',
  expiring: '即将过期',
};

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  '蔬菜',
  '肉蛋',
  '调味',
  '主食',
  '其他',
];

/** 廿四节气公历近似起始（非闰年 day-of-year），按年内顺序 */
export const SOLAR_TERM_APPROX: { term: SolarTerm; startDoy: number }[] = [
  { term: '小寒', startDoy: 6 }, // ≈1/6
  { term: '大寒', startDoy: 20 }, // ≈1/20
  { term: '立春', startDoy: 35 }, // ≈2/4
  { term: '雨水', startDoy: 50 }, // ≈2/19
  { term: '惊蛰', startDoy: 65 }, // ≈3/6
  { term: '春分', startDoy: 80 }, // ≈3/21
  { term: '清明', startDoy: 95 }, // ≈4/5
  { term: '谷雨', startDoy: 110 }, // ≈4/20
  { term: '立夏', startDoy: 126 }, // ≈5/6
  { term: '小满', startDoy: 141 }, // ≈5/21
  { term: '芒种', startDoy: 157 }, // ≈6/6
  { term: '夏至', startDoy: 172 }, // ≈6/21
  { term: '小暑', startDoy: 188 }, // ≈7/7
  { term: '大暑', startDoy: 204 }, // ≈7/23
  { term: '立秋', startDoy: 220 }, // ≈8/8
  { term: '处暑', startDoy: 235 }, // ≈8/23
  { term: '白露', startDoy: 251 }, // ≈9/8
  { term: '秋分', startDoy: 266 }, // ≈9/23
  { term: '寒露', startDoy: 281 }, // ≈10/8
  { term: '霜降', startDoy: 297 }, // ≈10/24
  { term: '立冬', startDoy: 312 }, // ≈11/8
  { term: '小雪', startDoy: 326 }, // ≈11/22
  { term: '大雪', startDoy: 341 }, // ≈12/7
  { term: '冬至', startDoy: 356 }, // ≈12/22
];

export const SOLAR_TERMS: SolarTerm[] = SOLAR_TERM_APPROX.map((t) => t.term);

export const STORAGE_KEYS = {
  preferences: 'wha2eat:preferences',
  fridge: 'wha2eat:fridge',
  weekPlan: 'wha2eat:weekPlan',
  shopping: 'wha2eat:shopping',
  recentDishes: 'wha2eat:recentDishes',
  cookRecords: 'wha2eat:cookRecords',
  dishLibrary: 'wha2eat:dishLibrary',
} as const;
