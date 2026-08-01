'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { INGREDIENT_CATEGORIES } from '@/lib/constants';
import { sameFood } from '@/lib/ingredients';
import {
  computeShopping,
  mergeShoppingList,
  shoppingItemKey,
} from '@/lib/shopping';
import type { FridgeItem } from '@/lib/types';

function newFridgeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `f-${Date.now()}`;
}

export default function ShoppingPage() {
  const { ready, weekPlan, fridge, shopping, setShopping, setFridge } = useApp();

  // 删除 tombstone：与 mergeShoppingList 同一套 shoppingItemKey（别名归一）
  const deletedKeysRef = useRef<Set<string>>(new Set());

  const computed = useMemo(() => {
    if (!weekPlan) return [];
    return computeShopping(weekPlan, fridge);
  }, [weekPlan, fridge]);

  // 过滤手动删除项；AppProvider.setFridge 重算后仍靠此 tombstone 挡住加回
  useEffect(() => {
    if (!ready) return;
    const filtered = computed.filter(
      (c) => !deletedKeysRef.current.has(shoppingItemKey(c.name, c.category))
    );
    const merged = mergeShoppingList(filtered, shopping);
    if (merged !== shopping) {
      setShopping(merged);
    }
  }, [ready, computed, shopping, setShopping]);

  // 勾选「已买」→ 写入冰箱（setFridge 会重算待购并移出该项）
  // 取消勾选且仍在清单 → 移出冰箱（重算后回到待购）；查找走 sameFood
  const toggleChecked = (idx: number) => {
    const item = shopping[idx];
    if (!item) return;
    const nextChecked = !item.checked;

    if (nextChecked) {
      const exists = fridge.some((f) => sameFood(f.name, item.name));
      if (!exists) {
        const fridgeItem: FridgeItem = {
          id: newFridgeId(),
          name: item.name.trim(),
          level: 'some',
        };
        setFridge([...fridge, fridgeItem]);
      } else {
        setShopping(shopping.filter((_, i) => i !== idx));
      }
    } else {
      const removeAt = fridge.findIndex((f) => sameFood(f.name, item.name));
      if (removeAt >= 0) {
        setFridge(fridge.filter((_, i) => i !== removeAt));
      } else {
        setShopping(
          shopping.map((s, i) =>
            i === idx ? { ...s, checked: false } : s
          )
        );
      }
    }
  };

  const removeItem = useCallback(
    (idx: number) => {
      const removed = shopping[idx];
      if (removed) {
        deletedKeysRef.current.add(
          shoppingItemKey(removed.name, removed.category)
        );
      }
      setShopping(shopping.filter((_, i) => i !== idx));
    },
    [shopping, setShopping]
  );

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    );
  }

  const grouped = INGREDIENT_CATEGORIES.map((cat) => ({
    category: cat,
    items: shopping
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.category === cat),
  }));

  const total = shopping.length;
  const done = shopping.filter((s) => s.checked).length;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">采购清单</h1>
          <p className="mt-1 text-sm text-zinc-500">
            菜谱食材 − 冰箱库存 · 已买 {done}/{total}
          </p>
        </div>
      </header>

      {!weekPlan || total === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mb-2 text-4xl">🛒</div>
          <p className="mb-1 font-medium text-zinc-700">采购清单为空</p>
          <p className="mb-4 text-sm text-zinc-400">
            {weekPlan ? '当前菜单无需额外采购' : '先生成一周菜单'}
          </p>
          <Link href="/plan" className="btn btn-primary">
            去生成菜单
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(
            ({ category, items }) =>
              items.length > 0 && (
                <section key={category}>
                  <h2 className="mb-2 text-sm font-semibold text-zinc-500">
                    {category}
                  </h2>
                  <ul className="space-y-1.5">
                    {items.map(({ item, idx }) => (
                      <li
                        key={`${item.name}-${idx}`}
                        className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm"
                      >
                        <label className="flex flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleChecked(idx)}
                            className="h-4 w-4 accent-emerald-600"
                          />
                          <span
                            className={`text-sm ${
                              item.checked
                                ? 'text-zinc-300 line-through'
                                : 'text-zinc-800'
                            }`}
                          >
                            {item.name}
                            <span className="ml-2 text-xs text-zinc-400">
                              {item.amount}
                            </span>
                            {item.suggestExtra && !item.checked && (
                              <span className="ml-2 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600">
                                建议多买：{item.suggestExtra}
                              </span>
                            )}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-xs text-zinc-300 hover:text-red-500"
                        >
                          删除
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
          )}
        </div>
      )}
    </div>
  );
}
