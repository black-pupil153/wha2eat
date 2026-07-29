import type { Preferences, FridgeItem, WeekPlan, ShoppingItem, CookRecord, Dish } from './types';
import { STORAGE_KEYS } from './constants';

function isClient(): boolean {
  return typeof window !== 'undefined';
}

function read<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储失败时静默忽略（如配额超限）
  }
}

function remove(key: string): void {
  if (!isClient()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const storage = {
  getPreferences(): Preferences | null {
    return read<Preferences | null>(STORAGE_KEYS.preferences, null);
  },
  setPreferences(p: Preferences): void {
    write(STORAGE_KEYS.preferences, p);
  },

  getFridge(): FridgeItem[] {
    return read<FridgeItem[]>(STORAGE_KEYS.fridge, []);
  },
  setFridge(items: FridgeItem[]): void {
    write(STORAGE_KEYS.fridge, items);
  },

  getWeekPlan(): WeekPlan | null {
    return read<WeekPlan | null>(STORAGE_KEYS.weekPlan, null);
  },
  setWeekPlan(plan: WeekPlan | null): void {
    if (plan === null) {
      remove(STORAGE_KEYS.weekPlan);
    } else {
      write(STORAGE_KEYS.weekPlan, plan);
    }
  },

  getShopping(): ShoppingItem[] {
    return read<ShoppingItem[]>(STORAGE_KEYS.shopping, []);
  },
  setShopping(items: ShoppingItem[]): void {
    write(STORAGE_KEYS.shopping, items);
  },

  getRecentDishes(): string[] {
    return read<string[]>(STORAGE_KEYS.recentDishes, []);
  },
  setRecentDishes(names: string[]): void {
    // 仅保留最近 40 条，避免无限增长
    const capped = names.slice(-40);
    write(STORAGE_KEYS.recentDishes, capped);
  },

  getCookRecords(): CookRecord[] {
    return read<CookRecord[]>(STORAGE_KEYS.cookRecords, []);
  },
  addCookRecord(record: CookRecord): void {
    const records = this.getCookRecords();
    records.push(record);
    write(STORAGE_KEYS.cookRecords, records);
  },
  setCookRecords(records: CookRecord[]): void {
    write(STORAGE_KEYS.cookRecords, records);
  },

  getDishLibrary(): Dish[] {
    return read<Dish[]>(STORAGE_KEYS.dishLibrary, []);
  },
  setDishLibrary(dishes: Dish[]): void {
    write(STORAGE_KEYS.dishLibrary, dishes);
  },
  upsertDish(dish: Dish): void {
    const library = this.getDishLibrary();
    const idx = library.findIndex((d) => d.id === dish.id);
    if (idx >= 0) {
      library[idx] = dish;
    } else {
      library.push(dish);
    }
    write(STORAGE_KEYS.dishLibrary, library);
  },

  hasPreferences(): boolean {
    if (!isClient()) return false;
    return window.localStorage.getItem(STORAGE_KEYS.preferences) !== null;
  },
};
