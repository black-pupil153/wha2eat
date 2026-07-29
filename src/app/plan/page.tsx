'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { BUDGET_LABEL } from '@/lib/constants';
import type { WeekPlan, DayPlan, Dish, FridgeItem, StockLevel, Rating, CookRecord } from '@/lib/types';
import ShareCard from '@/components/ShareCard';

const RATING_OPTIONS: { value: Rating; label: string; emoji: string }[] = [
  { value: 1, label: '踩雷', emoji: '😖' },
  { value: 2, label: '一般', emoji: '😐' },
  { value: 3, label: '满意', emoji: '😋' },
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = WEEKDAYS[d.getDay()];
  return `${m}月${day}日 ${wd}`;
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00').getDay();
  return d === 0 || d === 6;
}

export default function PlanPage() {
  const router = useRouter();
  const {
    ready,
    preferences,
    fridge,
    setFridge,
    weekPlan,
    setWeekPlan,
    cookRecords,
    recentDishes,
    pushRecentDishes,
    addCookRecord,
    upsertDish,
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapLoadingIdx, setSwapLoadingIdx] = useState<number | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);

  // 「做过了」弹窗状态
  const [modalDayIdx, setModalDayIdx] = useState<number | null>(null);
  const [modalRating, setModalRating] = useState<Rating | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // 未设置偏好时跳转
  useEffect(() => {
    if (ready && !preferences) {
      router.replace('/onboarding');
    }
  }, [ready, preferences, router]);

  const generatePlan = useCallback(async () => {
    if (!preferences) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          fridge,
          recentDishes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? '生成失败');
      }
      const plan = data.weekPlan as WeekPlan;
      setWeekPlan(plan);
      // 记录近 2 周吃过的菜名
      const names = Object.values(plan.dishes).map((d) => d.name);
      pushRecentDishes(names);
      // 将新菜写入菜谱库
      for (const dish of Object.values(plan.dishes)) {
        upsertDish(dish);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成菜单失败');
    } finally {
      setLoading(false);
    }
  }, [preferences, fridge, recentDishes, setWeekPlan, pushRecentDishes, upsertDish]);

  const swapDish = useCallback(
    async (dayIndex: number) => {
      if (!preferences || !weekPlan) return;
      setSwapLoadingIdx(dayIndex);
      setError(null);
      try {
        const excludeNames = Object.values(weekPlan.dishes).map(
          (d) => d.name
        );
        const res = await fetch('/api/dish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preferences,
            fridge,
            excludeDishNames: excludeNames,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? '换菜失败');
        }
        const newDish = data.dish as Dish;
        const day = weekPlan.days[dayIndex];
        const updated: WeekPlan = {
          ...weekPlan,
          dishes: { ...weekPlan.dishes, [newDish.id]: newDish },
          days: weekPlan.days.map((d, i) =>
            i === dayIndex ? { ...d, dishId: newDish.id, isTakeout: false } : d
          ),
        };
        setWeekPlan(updated);
        pushRecentDishes([newDish.name]);
        upsertDish(newDish);
      } catch (e) {
        setError(e instanceof Error ? e.message : '换菜失败');
      } finally {
        setSwapLoadingIdx(null);
      }
    },
    [preferences, weekPlan, fridge, setWeekPlan, pushRecentDishes, upsertDish]
  );

  const toggleTakeout = useCallback(
    (dayIndex: number) => {
      if (!weekPlan) return;
      const updated: WeekPlan = {
        ...weekPlan,
        days: weekPlan.days.map((d, i) =>
          i === dayIndex ? { ...d, isTakeout: !d.isTakeout } : d
        ),
      };
      setWeekPlan(updated);
    },
    [weekPlan, setWeekPlan]
  );

  // 「做过了」：标记已完成 + 自动扣减冰箱库存
  const markCooked = useCallback(
    (dayIndex: number) => {
      if (!weekPlan) return;
      const day = weekPlan.days[dayIndex];
      const dish = day.dishId ? weekPlan.dishes[day.dishId] : null;
      if (!dish) return;

      // 扣减逻辑：将菜品食材与冰箱匹配，每个匹配的食材降一级（plenty→some→low→移除）
      const levelDown: Record<StockLevel, StockLevel | null> = {
        plenty: 'some',
        some: 'low',
        low: null, // 用完移除
        expiring: null,
      };
      const ingredientNames = new Set(
        dish.ingredients.map((ing) => ing.name.trim().toLowerCase())
      );
      // usesFridgeItems 也纳入扣减范围
      for (const name of dish.usesFridgeItems) {
        ingredientNames.add(name.trim().toLowerCase());
      }

      const newFridge: FridgeItem[] = [];
      for (const item of fridge) {
        if (ingredientNames.has(item.name.trim().toLowerCase())) {
          const next = levelDown[item.level];
          if (next) {
            newFridge.push({ ...item, level: next });
          }
          // next 为 null 表示用完，不加入新列表
        } else {
          newFridge.push(item);
        }
      }
      setFridge(newFridge);

      // 标记该天为已做
      const updated: WeekPlan = {
        ...weekPlan,
        days: weekPlan.days.map((d, i) =>
          i === dayIndex ? { ...d, isCooked: true } : d
        ),
      };
      setWeekPlan(updated);
    },
    [weekPlan, fridge, setFridge, setWeekPlan]
  );

  // 打开「做过了」弹窗
  const openCookModal = useCallback((dayIndex: number) => {
    setModalDayIdx(dayIndex);
    setModalRating(null);
    setModalNote('');
  }, []);

  // 关闭弹窗
  const closeCookModal = useCallback(() => {
    setModalDayIdx(null);
    setModalRating(null);
    setModalNote('');
  }, []);

  // 提交评分 + 笔记
  const submitCookRecord = useCallback(() => {
    if (modalDayIdx === null || modalRating === null || !weekPlan) return;
    setModalSubmitting(true);

    const day = weekPlan.days[modalDayIdx];
    const dish = day.dishId ? weekPlan.dishes[day.dishId] : null;
    if (!dish) { setModalSubmitting(false); return; }

    // 写入 CookRecord
    const record: CookRecord = {
      id: `cr-${Date.now()}`,
      dishId: dish.id,
      dishName: dish.name,
      date: day.date,
      rating: modalRating,
      notes: modalNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    addCookRecord(record);

    // 执行库存扣减 + 标记已做
    markCooked(modalDayIdx);
    closeCookModal();
    setModalSubmitting(false);
  }, [modalDayIdx, modalRating, modalNote, weekPlan, addCookRecord, markCooked, closeCookModal]);

  if (!ready || !preferences) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">本周菜单</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {preferences.cookDaysPerWeek} 天晚餐 · {preferences.servings} 人份 ·{' '}
            {BUDGET_LABEL[preferences.budget]}预算
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generatePlan}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '生成中…' : weekPlan ? '重新生成' : '生成菜单'}
          </button>
          {weekPlan && (
            <button
              type="button"
              onClick={() => setShowShareCard(true)}
              className="btn btn-ghost text-sm"
            >
              📤 分享卡片
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !weekPlan && (
        <div className="space-y-3">
          {Array.from({ length: preferences.cookDaysPerWeek }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-zinc-200/60"
            />
          ))}
        </div>
      )}

      {!loading && !weekPlan && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mb-3 text-5xl">🍽️</div>
          <p className="mb-1 font-medium text-zinc-700">
            还没有菜单
          </p>
          <p className="mb-5 text-sm text-zinc-400">
            点击「生成菜单」，AI 会根据你的偏好和冰箱库存规划一周晚餐
          </p>
          <button
            type="button"
            onClick={generatePlan}
            className="btn btn-primary"
          >
            立即生成
          </button>
        </div>
      )}

      {weekPlan && (
        <div className="space-y-3">
          {showShareCard && (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-700">生成分享卡片</h2>
                <button
                  type="button"
                  onClick={() => setShowShareCard(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  关闭
                </button>
              </div>
              <ShareCard weekPlan={weekPlan} />
            </div>
          )}
          {weekPlan.days.map((day: DayPlan, idx: number) => {
            const dish = day.dishId ? weekPlan.dishes[day.dishId] : null;
            const weekend = isWeekend(day.date);
            const swapping = swapLoadingIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-800">
                      {formatDateLabel(day.date)}
                    </span>
                    {weekend && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        周末
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTakeout(idx)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      day.isTakeout
                        ? 'bg-zinc-800 text-white'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                  >
                    {day.isTakeout ? '已设为外食' : '不想做饭'}
                  </button>
                </div>

                {day.isTakeout ? (
                  <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-4 text-zinc-400">
                    <span className="text-2xl">🥡</span>
                    <span className="text-sm">今天外食 / 点外卖</span>
                  </div>
                ) : dish ? (
                  <Link
                    href={`/dish/${dish.id}`}
                    className="block rounded-xl p-3 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900">
                            {dish.name}
                          </h3>
                          {day.kind === 'new' && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              新课
                            </span>
                          )}
                          {day.kind === 'review' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              复习
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">
                          {dish.description}
                        </p>
                        {day.kind === 'review' && (() => {
                          const lastNote = cookRecords
                            .filter((cr) => cr.dishId === dish.id && cr.notes)
                            .sort((a, b) => b.date.localeCompare(a.date))[0]?.notes;
                          return lastNote ? (
                            <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                              💡 上次你说：{lastNote}
                            </p>
                          ) : null;
                        })()}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span>⏱ {dish.minutes} 分钟</span>
                          <span>💰 {BUDGET_LABEL[dish.costLevel]}</span>
                          {dish.usesFridgeItems.length > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600">
                              消耗库存：{dish.usesFridgeItems.join('、')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-zinc-300">›</span>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-400">
                    暂无菜品
                  </div>
                )}

                {!day.isTakeout && (
                  <div className="mt-2 flex justify-end gap-2">
                    {day.isCooked ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                        ✓ 做过了
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setModalDayIdx(idx)}
                          className="btn btn-ghost text-xs text-emerald-600"
                        >
                          做过了
                        </button>
                        <button
                          type="button"
                          onClick={() => swapDish(idx)}
                          disabled={swapping}
                          className="btn btn-ghost text-xs"
                        >
                          {swapping ? '换菜中…' : '换一道'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* 「做过了」评分弹窗 */}
      {modalDayIdx !== null && weekPlan && (() => {
        const day = weekPlan.days[modalDayIdx];
        const dish = day?.dishId ? weekPlan.dishes[day.dishId] : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="text-lg font-bold text-zinc-900">
                做过「{dish?.name ?? '这道菜'}」了
              </h3>
              <p className="mt-1 text-sm text-zinc-500">打个分，记录一下做得怎么样</p>

              {/* 评分选择 */}
              <div className="mt-5 flex gap-3">
                {RATING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setModalRating(opt.value)}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all ${
                      modalRating === opt.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* 可选改进要点 */}
              <div className="mt-4">
                <label className="text-sm font-medium text-zinc-700">
                  改进要点（可选）
                </label>
                <textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="如：盐减半、多放蒜…"
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              {/* 操作按钮 */}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeCookModal}
                  className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitCookRecord}
                  disabled={modalRating === null || modalSubmitting}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {modalSubmitting ? '保存中…' : '提交'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
