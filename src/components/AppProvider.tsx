'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Preferences,
  FridgeItem,
  WeekPlan,
  ShoppingItem,
  CookRecord,
  Dish,
  Rating,
} from '@/lib/types';
import { storage } from '@/lib/storage';
import { computeShopping, mergeShoppingList } from '@/lib/shopping';
import { deductFridge } from '@/lib/ingredients';

interface AppContextValue {
  ready: boolean;
  preferences: Preferences | null;
  fridge: FridgeItem[];
  weekPlan: WeekPlan | null;
  shopping: ShoppingItem[];
  cookRecords: CookRecord[];
  dishLibrary: Dish[];
  setPreferences: (p: Preferences) => void;
  setFridge: (items: FridgeItem[]) => void;
  setWeekPlan: (plan: WeekPlan | null) => void;
  setShopping: (items: ShoppingItem[]) => void;
  setCookRecords: (records: CookRecord[]) => void;
  setDishLibrary: (dishes: Dish[]) => void;
  addCookRecord: (record: CookRecord) => void;
  upsertDish: (dish: Dish) => void;
  /** 「做过了」全流程唯一入口：写 CookRecord + 库存扣减 + 标记当天已做；成功返回 true */
  completeCook: (input: {
    dishId: string;
    date: string;
    rating: Rating;
    notes?: string;
  }) => boolean;
  recentDishes: string[];
  pushRecentDishes: (names: string[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferencesState] = useState<Preferences | null>(null);
  const [fridge, setFridgeState] = useState<FridgeItem[]>([]);
  const [weekPlan, setWeekPlanState] = useState<WeekPlan | null>(null);
  const [shopping, setShoppingState] = useState<ShoppingItem[]>([]);
  const [cookRecords, setCookRecordsState] = useState<CookRecord[]>([]);
  const [dishLibrary, setDishLibraryState] = useState<Dish[]>([]);
  const [recentDishes, setRecentDishesState] = useState<string[]>([]);

  const fridgeRef = useRef(fridge);
  const weekPlanRef = useRef(weekPlan);

  useEffect(() => {
    fridgeRef.current = fridge;
    weekPlanRef.current = weekPlan;
  }, [fridge, weekPlan]);

  // 按菜单 − 冰箱重算待购，保留勾选
  const syncShoppingFrom = useCallback(
    (nextFridge: FridgeItem[], nextPlan: WeekPlan | null) => {
      if (!nextPlan) return;
      setShoppingState((prev) => {
        const next = mergeShoppingList(
          computeShopping(nextPlan, nextFridge),
          prev
        );
        if (next !== prev) storage.setShopping(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage 水合，仅挂载时执行一次
    setPreferencesState(storage.getPreferences());
    setFridgeState(storage.getFridge());
    setWeekPlanState(storage.getWeekPlan());
    setShoppingState(storage.getShopping());
    setCookRecordsState(storage.getCookRecords());
    setDishLibraryState(storage.getDishLibrary());
    setRecentDishesState(storage.getRecentDishes());
    setReady(true);
  }, []);

  const setPreferences = useCallback((p: Preferences) => {
    storage.setPreferences(p);
    setPreferencesState(p);
  }, []);

  const setFridge = useCallback(
    (items: FridgeItem[]) => {
      storage.setFridge(items);
      fridgeRef.current = items;
      setFridgeState(items);
      // 冰箱变更立刻重算采购（含在冰箱页删除后应回到待购）
      syncShoppingFrom(items, weekPlanRef.current);
    },
    [syncShoppingFrom]
  );

  const setWeekPlan = useCallback(
    (plan: WeekPlan | null) => {
      storage.setWeekPlan(plan);
      weekPlanRef.current = plan;
      setWeekPlanState(plan);
      syncShoppingFrom(fridgeRef.current, plan);
    },
    [syncShoppingFrom]
  );

  const setShopping = useCallback((items: ShoppingItem[]) => {
    storage.setShopping(items);
    setShoppingState(items);
  }, []);

  const setCookRecords = useCallback((records: CookRecord[]) => {
    storage.setCookRecords(records);
    setCookRecordsState(records);
  }, []);

  const setDishLibrary = useCallback((dishes: Dish[]) => {
    storage.setDishLibrary(dishes);
    setDishLibraryState(dishes);
  }, []);

  const addCookRecord = useCallback((record: CookRecord) => {
    storage.addCookRecord(record);
    setCookRecordsState((prev) => [...prev, record]);
  }, []);

  const upsertDish = useCallback((dish: Dish) => {
    storage.upsertDish(dish);
    setDishLibraryState((prev) => {
      const idx = prev.findIndex((d) => d.id === dish.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = dish;
        return next;
      }
      return [...prev, dish];
    });
  }, []);

  // 「做过了」唯一入口：评分/笔记落 CookRecord，库存降档，当天 isCooked 置 true
  const completeCook = useCallback(
    (input: { dishId: string; date: string; rating: Rating; notes?: string }): boolean => {
      const plan = weekPlanRef.current;
      const dish =
        plan?.dishes[input.dishId] ??
        storage.getDishLibrary().find((d) => d.id === input.dishId) ??
        null;
      if (!dish) return false;

      const record: CookRecord = {
        id: `cr-${Date.now()}`,
        dishId: dish.id,
        dishName: dish.name,
        date: input.date,
        rating: input.rating,
        notes: input.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      storage.addCookRecord(record);
      setCookRecordsState((prev) => [...prev, record]);

      // 库存扣减（别名匹配，瓶罐调味跳过）
      const nextFridge = deductFridge(fridgeRef.current, dish);
      storage.setFridge(nextFridge);
      fridgeRef.current = nextFridge;
      setFridgeState(nextFridge);

      // 标记当天已做
      if (plan) {
        const updated: WeekPlan = {
          ...plan,
          days: plan.days.map((d) =>
            d.date === input.date && d.dishId === input.dishId
              ? { ...d, isCooked: true }
              : d
          ),
        };
        storage.setWeekPlan(updated);
        weekPlanRef.current = updated;
        setWeekPlanState(updated);
        syncShoppingFrom(nextFridge, updated);
      } else {
        syncShoppingFrom(nextFridge, null);
      }
      return true;
    },
    [syncShoppingFrom]
  );

  const pushRecentDishes = useCallback(
    (names: string[]) => {
      const merged = [...recentDishes, ...names];
      const deduped = Array.from(new Set(merged));
      storage.setRecentDishes(deduped);
      setRecentDishesState(deduped);
    },
    [recentDishes]
  );

  const value: AppContextValue = {
    ready,
    preferences,
    fridge,
    weekPlan,
    shopping,
    cookRecords,
    dishLibrary,
    setPreferences,
    setFridge,
    setWeekPlan,
    setShopping,
    setCookRecords,
    setDishLibrary,
    addCookRecord,
    upsertDish,
    completeCook,
    recentDishes,
    pushRecentDishes,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp 必须在 AppProvider 内使用');
  }
  return ctx;
}
