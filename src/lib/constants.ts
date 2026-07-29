import type { Budget, StockLevel, IngredientCategory } from './types';

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

export const STORAGE_KEYS = {
  preferences: 'wha2eat:preferences',
  fridge: 'wha2eat:fridge',
  weekPlan: 'wha2eat:weekPlan',
  shopping: 'wha2eat:shopping',
  recentDishes: 'wha2eat:recentDishes',
  cookRecords: 'wha2eat:cookRecords',
  dishLibrary: 'wha2eat:dishLibrary',
} as const;
