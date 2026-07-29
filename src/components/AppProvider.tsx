'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
} from '@/lib/types';
import { storage } from '@/lib/storage';

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

  const setFridge = useCallback((items: FridgeItem[]) => {
    storage.setFridge(items);
    setFridgeState(items);
  }, []);

  const setWeekPlan = useCallback((plan: WeekPlan | null) => {
    storage.setWeekPlan(plan);
    setWeekPlanState(plan);
  }, []);

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
