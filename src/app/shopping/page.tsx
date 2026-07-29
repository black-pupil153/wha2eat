'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { INGREDIENT_CATEGORIES } from '@/lib/constants';
import type { ShoppingItem, WeekPlan, FridgeItem } from '@/lib/types';

const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAYS_SHORT[d.getDay()];
}

/**
 * 解析数量字符串，提取数值和单位。
 * 例: "200g" → { value: 200, unit: "g" }
 *      "3个" → { value: 3, unit: "个" }
 *      "适量" → null
 */
function parseAmount(raw: string): { value: number; unit: string } | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: m[2].trim() };
}

/**
 * 同单位数值加总；单位不同或无法解析时保留原样拼接。
 */
function addAmounts(a: string, b: string): string {
  const pa = parseAmount(a);
  const pb = parseAmount(b);
  if (pa && pb && pa.unit === pb.unit) {
    const sum = pa.value + pb.value;
    // 整数不显示小数点
    const num = Number.isInteger(sum) ? sum.toString() : sum.toFixed(1);
    return `${num}${pa.unit}`;
  }
  return `${a} + ${b}`;
}

function computeShopping(
  weekPlan: WeekPlan,
  fridge: FridgeItem[]
): ShoppingItem[] {
  const fridgeSet = new Set(
    fridge.map((n) => n.name.trim().toLowerCase())
  );

  // 收集未做过的天的菜品食材，并记录每道食材被哪些菜使用
  const merged = new Map<string, ShoppingItem>();
  const usageMap = new Map<string, string[]>(); // key → ["周三 番茄炒蛋", ...]

  for (const day of weekPlan.days) {
    if (day.isTakeout || day.isCooked || !day.dishId) continue;
    const dish = weekPlan.dishes[day.dishId];
    if (!dish) continue;
    const label = `${dayLabel(day.date)} ${dish.name}`;
    for (const ing of dish.ingredients) {
      const key = `${ing.name}__${ing.category}`;
      const existing = merged.get(key);
      if (existing) {
        existing.amount = addAmounts(existing.amount, ing.amount);
      } else {
        merged.set(key, {
          name: ing.name,
          amount: ing.amount,
          category: ing.category,
          checked: false,
        });
      }
      const usages = usageMap.get(key) ?? [];
      usages.push(label);
      usageMap.set(key, usages);
    }
  }

  // 减去冰箱已有的，并为多次使用的食材添加「建议多买」标签
  const result: ShoppingItem[] = [];
  for (const [key, item] of merged) {
    if (fridgeSet.has(item.name.trim().toLowerCase())) continue;
    const usages = usageMap.get(key) ?? [];
    if (usages.length >= 2) {
      item.suggestExtra = usages.join(' + ');
    }
    result.push(item);
  }
  return result;
}

export default function ShoppingPage() {
  const { ready, weekPlan, fridge, shopping, setShopping } = useApp();

  // 记录用户手动删除的食材 key（name__category），防止 useEffect 重新加回
  const deletedKeysRef = useRef<Set<string>>(new Set());

  // 根据当前菜单自动计算采购清单（仅首次或菜单变化时）
  const computed = useMemo(() => {
    if (!weekPlan) return [];
    return computeShopping(weekPlan, fridge);
  }, [weekPlan, fridge]);

  // 当菜单变化（换一道/不想做饭/重新生成）时，重新计算并保留已有勾选状态
  useEffect(() => {
    if (!ready) return;
    // 过滤掉用户已删除的项
    const filtered = computed.filter(
      (c) => !deletedKeysRef.current.has(`${c.name}__${c.category}`)
    );
    // 构建旧列表的 checked 映射（name+category → checked）
    const prevChecked = new Map(
      shopping.map((s) => [`${s.name}__${s.category}`, s.checked])
    );
    // 将已保存的勾选状态合并到新计算结果
    const merged = filtered.map((c) => ({
      ...c,
      checked: prevChecked.get(`${c.name}__${c.category}`) ?? false,
    }));
    // 仅在列表内容（名称+分类+数量）确实变化时才更新，避免无限循环
    const changed =
      merged.length !== shopping.length ||
      merged.some(
        (m, i) =>
          shopping[i]?.name !== m.name ||
          shopping[i]?.category !== m.category ||
          shopping[i]?.amount !== m.amount
      );
    if (changed) {
      setShopping(merged);
    }
  }, [ready, computed, shopping, setShopping]);

  const toggleChecked = (idx: number) => {
    setShopping(
      shopping.map((s, i) => (i === idx ? { ...s, checked: !s.checked } : s))
    );
  };

  const removeItem = useCallback(
    (idx: number) => {
      const removed = shopping[idx];
      if (removed) {
        deletedKeysRef.current.add(`${removed.name}__${removed.category}`);
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
