// PRD §4 数据模型

export type Budget = 'low' | 'mid' | 'any';
export type StockLevel = 'plenty' | 'some' | 'low' | 'expiring';
export type IngredientCategory = '蔬菜' | '肉蛋' | '调味' | '主食' | '其他';

export interface Preferences {
  servings: number; // 1-6
  avoidances: string[]; // 忌口
  tastes: string[]; // 口味偏好
  cookDaysPerWeek: number; // 3-7
  budget: Budget;
}

export interface FridgeItem {
  id: string;
  name: string;
  level: StockLevel;
}

export interface Ingredient {
  name: string;
  amount: string; // 如 "200g"、"2个"
  category: IngredientCategory;
}

export interface Dish {
  id: string;
  name: string;
  description: string; // 一句话
  minutes: number;
  costLevel: Budget;
  ingredients: Ingredient[];
  steps: string[];
  usesFridgeItems: string[]; // 命中的库存食材名
  /** 所属廿四节气；旧数据缺省视为 [] */
  solarTerms?: SolarTerm[];
  /** 菜谱原始份量（人份）；缺省视为 2，用于按人数换算 */
  baseServings?: number;
  /** 菜谱来源：howtocook 底库 / ai 生成；缺省视为 ai（旧数据） */
  source?: 'howtocook' | 'ai';
}

/** 廿四节气 */
export type SolarTerm =
  | '立春'
  | '雨水'
  | '惊蛰'
  | '春分'
  | '清明'
  | '谷雨'
  | '立夏'
  | '小满'
  | '芒种'
  | '夏至'
  | '小暑'
  | '大暑'
  | '立秋'
  | '处暑'
  | '白露'
  | '秋分'
  | '寒露'
  | '霜降'
  | '立冬'
  | '小雪'
  | '大雪'
  | '冬至'
  | '小寒'
  | '大寒';

export interface DayPlan {
  date: string; // ISO 日期 YYYY-MM-DD
  dishId: string | null; // null 表示"不想做饭"
  isTakeout: boolean;
  isCooked?: boolean; // 标记"做过了"，触发库存扣减
  kind?: 'new' | 'review'; // 新课 or 复习
}

export interface WeekPlan {
  id: string;
  createdAt: string;
  days: DayPlan[];
  dishes: Record<string, Dish>;
}

export interface ShoppingItem {
  name: string;
  amount: string;
  category: IngredientCategory;
  checked: boolean;
  suggestExtra?: string; // 前瞻性囤货原因，如“周三番茄炒蛋 + 周五蒸蛋”
}

// LLM 输出结构
export interface LLMAssignment {
  dayIndex: number;
  dishId: string;
}

export interface LLMPlanResult {
  dishes: Dish[];
  assignments: LLMAssignment[];
}

// ── M4: 复习调度相关类型 ──

/** 评分：1=踩雷, 2=一般, 3=满意 */
export type Rating = 1 | 2 | 3;

/** 掌握度 */
export type Mastery = 'learning' | 'familiar' | 'mastered';

/** 单次做菜记录 */
export interface CookRecord {
  id: string;
  dishId: string;
  dishName: string;
  date: string; // YYYY-MM-DD（本地时区）
  rating: Rating;
  notes?: string; // 改进要点
  createdAt: string; // ISO timestamp
}

/** 待复习 / 库内占槽菜品 */
export interface DueDish {
  dishId: string;
  dishName: string;
  overdueDays: number;
  lastCookedDate: string; // YYYY-MM-DD
  mastery: Mastery;
  /** 应季分 0/1/2，见 solar.seasonScore */
  seasonScore?: number;
}
