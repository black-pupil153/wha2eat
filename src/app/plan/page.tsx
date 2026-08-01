'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { BUDGET_LABEL } from '@/lib/constants';
import { selectLibrarySlots, rankLibraryCandidates } from '@/lib/review';
import { getSolarWindow, isInSeason } from '@/lib/solar';
import type { WeekPlan, DayPlan, Dish } from '@/lib/types';
import ShareCard from '@/components/ShareCard';
import CookDoneModal from '@/components/CookDoneModal';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = WEEKDAYS[d.getDay()];
  return `${m}月${day}日 ${wd}`;
}

/** 从 API 响应取出可读错误，避免非 JSON 导致静默失败 */
async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data?.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export default function PlanPage() {
  const router = useRouter();
  const {
    ready,
    preferences,
    fridge,
    weekPlan,
    setWeekPlan,
    cookRecords,
    dishLibrary,
    recentDishes,
    pushRecentDishes,
    upsertDish,
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapLoadingIdx, setSwapLoadingIdx] = useState<number | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showWeek, setShowWeek] = useState(true);

  // 「做过了」弹窗（唯一入口组件）
  const [cookModal, setCookModal] = useState<{
    dishId: string;
    dishName: string;
    date: string;
  } | null>(null);

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
      const today = localToday();
      const window = getSolarWindow(today);
      const slots = selectLibrarySlots(
        cookRecords,
        dishLibrary,
        today,
        preferences.cookDaysPerWeek,
        window
      );

      const reviewDishes = slots.map((slot) => {
        const dish = dishLibrary.find((d) => d.id === slot.dishId);
        if (!dish) return null;
        const lastNote = cookRecords
          .filter((cr) => cr.dishId === slot.dishId && cr.notes)
          .sort((a, b) => b.date.localeCompare(a.date))[0]?.notes;
        return {
          ...slot,
          dish,
          notes: lastNote,
        };
      }).filter(Boolean);

      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          fridge,
          recentDishes,
          reviewDishes,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, '生成失败，请稍后重试'));
      }
      const data = (await res.json()) as { weekPlan?: WeekPlan };
      if (!data.weekPlan) {
        throw new Error('生成失败：未返回菜单数据');
      }
      const plan = data.weekPlan;
      setWeekPlan(plan);
      const names = Object.values(plan.dishes).map((d) => d.name);
      pushRecentDishes(names);
      for (const dish of Object.values(plan.dishes)) {
        upsertDish(dish);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成菜单失败');
    } finally {
      setLoading(false);
    }
  }, [
    preferences,
    fridge,
    recentDishes,
    cookRecords,
    dishLibrary,
    setWeekPlan,
    pushRecentDishes,
    upsertDish,
  ]);

  const swapDish = useCallback(
    async (dayIndex: number) => {
      if (!preferences || !weekPlan) return;
      setSwapLoadingIdx(dayIndex);
      setError(null);
      try {
        const day = weekPlan.days[dayIndex];

        // 库内占槽：按节气>到期取下一道，不调 LLM
        if (day.kind === 'review') {
          const today = localToday();
          const window = getSolarWindow(today);
          const ranked = rankLibraryCandidates(
            cookRecords,
            dishLibrary,
            today,
            window
          );
          const usedIds = new Set(
            weekPlan.days
              .map((d) => d.dishId)
              .filter((id): id is string => !!id)
          );
          const next = ranked.find((c) => !usedIds.has(c.dishId));
          const nextDish = next
            ? dishLibrary.find((d) => d.id === next.dishId)
            : null;

          if (nextDish) {
            const updated: WeekPlan = {
              ...weekPlan,
              dishes: { ...weekPlan.dishes, [nextDish.id]: nextDish },
              days: weekPlan.days.map((d, i) =>
                i === dayIndex
                  ? {
                      ...d,
                      dishId: nextDish.id,
                      isTakeout: false,
                      kind: 'review',
                    }
                  : d
              ),
            };
            setWeekPlan(updated);
            return;
          }
          // 无剩余库内候选 → 退化为新课换菜
        }

        const excludeNames = Object.values(weekPlan.dishes).map((d) => d.name);
        const res = await fetch('/api/dish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preferences,
            fridge,
            excludeDishNames: [...excludeNames, ...recentDishes],
          }),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, '换菜失败，请稍后重试'));
        }
        const data = (await res.json()) as { dish?: Dish };
        if (!data.dish) {
          throw new Error('换菜失败：未返回菜品数据');
        }
        const newDish = data.dish;
        const updated: WeekPlan = {
          ...weekPlan,
          dishes: { ...weekPlan.dishes, [newDish.id]: newDish },
          days: weekPlan.days.map((d, i) =>
            i === dayIndex
              ? { ...d, dishId: newDish.id, isTakeout: false, kind: 'new' }
              : d
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
    [
      preferences,
      weekPlan,
      fridge,
      cookRecords,
      dishLibrary,
      recentDishes,
      setWeekPlan,
      pushRecentDishes,
      upsertDish,
    ]
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

  if (!ready || !preferences) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    );
  }

  const today = localToday();
  const window = getSolarWindow(today);
  const todayIdx = weekPlan
    ? weekPlan.days.findIndex((d) => d.date === today)
    : -1;
  const todayPlan = todayIdx >= 0 && weekPlan ? weekPlan.days[todayIdx] : null;
  const todayDish =
    todayPlan?.dishId && weekPlan ? weekPlan.dishes[todayPlan.dishId] : null;
  const todayLastNote = todayDish
    ? cookRecords
        .filter((cr) => cr.dishId === todayDish.id && cr.notes)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.notes
    : undefined;
  const lastNoteFor = (dishId: string) =>
    cookRecords
      .filter((cr) => cr.dishId === dishId && cr.notes)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.notes;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── 今晚 ── */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">今晚</h1>
          <span className="text-xs text-zinc-400">
            {formatDateLabel(today)} · {window.current}
          </span>
        </div>

        {!weekPlan && !loading && (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-sm sm:p-8">
            <div className="mb-2 text-4xl">🍳</div>
            <h2 className="text-lg font-bold sm:text-xl">
              今晚吃什么？一键安排好这一周
            </h2>
            <p className="mt-1 text-sm text-emerald-50">
              {preferences.cookDaysPerWeek} 天晚餐 · {preferences.servings} 人份 · 应季 + 待复习的菜优先
            </p>
            <button
              type="button"
              onClick={generatePlan}
              className="mt-5 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-emerald-700 shadow hover:bg-emerald-50"
            >
              立即生成本周菜单
            </button>
          </div>
        )}

        {loading && (
          <div className="h-48 animate-pulse rounded-2xl bg-zinc-200/60" />
        )}

        {weekPlan && !loading && !todayPlan && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <div className="mb-2 text-3xl">📅</div>
            <p className="font-medium text-zinc-700">这份菜单不包含今天</p>
            <p className="mt-1 text-sm text-zinc-400">
              可能是上周生成的，重新生成一份从今晚开始的菜单吧
            </p>
            <button
              type="button"
              onClick={generatePlan}
              className="btn btn-primary mt-4"
            >
              重新生成
            </button>
          </div>
        )}

        {weekPlan && !loading && todayPlan && todayPlan.isTakeout && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🥡</span>
              <div>
                <p className="font-semibold text-zinc-800">今晚外食 / 点外卖</p>
                <p className="text-sm text-zinc-400">休息一晚也很好</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleTakeout(todayIdx)}
              className="btn btn-ghost mt-4 text-sm text-emerald-600"
            >
              还是想做饭
            </button>
          </div>
        )}

        {weekPlan && !loading && todayPlan && !todayPlan.isTakeout && !todayDish && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="font-medium text-zinc-700">今晚菜谱数据缺失</p>
            <p className="mt-1 text-sm text-zinc-400">
              可能是旧菜单残留，重新生成或换一道即可
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={generatePlan} className="btn btn-primary">
                重新生成
              </button>
              <button
                type="button"
                onClick={() => swapDish(todayIdx)}
                disabled={swapLoadingIdx === todayIdx}
                className="btn btn-ghost text-sm"
              >
                {swapLoadingIdx === todayIdx ? '换菜中…' : '换一道'}
              </button>
            </div>
          </div>
        )}

        {weekPlan && !loading && todayPlan && !todayPlan.isTakeout && todayDish && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {todayPlan.isCooked && (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    ✓ 今晚已完成
                  </span>
                )}
                {todayPlan.kind === 'review' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    再练一次
                  </span>
                )}
                {todayPlan.kind === 'new' && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    新菜
                  </span>
                )}
                {isInSeason(todayDish, window) && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    应季
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl">
                {todayDish.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">{todayDish.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1">
                  ⏱ 约 {todayDish.minutes} 分钟
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1">
                  💰 {BUDGET_LABEL[todayDish.costLevel]}
                </span>
                {todayDish.usesFridgeItems.length > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-600">
                    用掉冰箱里的：{todayDish.usesFridgeItems.join('、')}
                  </span>
                )}
              </div>
              {todayLastNote && !todayPlan.isCooked && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  💡 上次你说：{todayLastNote}
                </p>
              )}
            </div>

            {!todayPlan.isCooked && (
              <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 sm:px-6">
                <Link
                  href={`/dish/${todayDish.id}?cook=1`}
                  className="btn btn-primary flex-1 text-center text-base font-bold"
                >
                  开始做 →
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setCookModal({
                      dishId: todayDish.id,
                      dishName: todayDish.name,
                      date: todayPlan.date,
                    })
                  }
                  className="btn btn-ghost text-xs text-emerald-600"
                >
                  做过了
                </button>
                <button
                  type="button"
                  onClick={() => swapDish(todayIdx)}
                  disabled={swapLoadingIdx === todayIdx}
                  className="btn btn-ghost text-xs"
                >
                  {swapLoadingIdx === todayIdx ? '换菜中…' : '换一道'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleTakeout(todayIdx)}
                  className="btn btn-ghost text-xs text-zinc-400"
                >
                  不想做
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 本周 ── */}
      {weekPlan && !loading && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowWeek((v) => !v)}
              className="flex items-center gap-1 text-base font-bold text-zinc-800"
            >
              本周安排
              <span className="text-xs text-zinc-400">{showWeek ? '▾' : '▸'}</span>
            </button>
            <div className="flex items-center gap-1">
              <Link href="/shopping" className="btn btn-ghost text-xs text-emerald-600">
                🛒 去采购
              </Link>
              <button
                type="button"
                onClick={() => setShowShareCard(true)}
                className="btn btn-ghost text-xs"
              >
                📤 分享卡片
              </button>
              <button
                type="button"
                onClick={generatePlan}
                disabled={loading}
                className="btn btn-ghost text-xs"
              >
                重新生成
              </button>
            </div>
          </div>

          {showShareCard && (
            <div className="mb-3 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
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

          {showWeek && (
            <div className="space-y-2">
              {weekPlan.days.map((day: DayPlan, idx: number) => {
                const dish = day.dishId ? weekPlan.dishes[day.dishId] : null;
                const isToday = day.date === today;
                const swapping = swapLoadingIdx === idx;
                const note = dish && day.kind === 'review' ? lastNoteFor(dish.id) : undefined;
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl bg-white p-3.5 shadow-sm ${
                      isToday ? 'ring-2 ring-emerald-500/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-500">
                        {formatDateLabel(day.date)}
                        {isToday && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            今晚
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleTakeout(idx)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                          day.isTakeout
                            ? 'bg-zinc-800 text-white'
                            : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                        }`}
                      >
                        {day.isTakeout ? '已设为外食' : '不想做饭'}
                      </button>
                    </div>

                    {day.isTakeout ? (
                      <div className="mt-2 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-400">
                        🥡 外食 / 点外卖
                      </div>
                    ) : dish ? (
                      <div className="mt-1.5">
                        <Link
                          href={`/dish/${dish.id}`}
                          className="block rounded-xl px-1 py-1 transition-colors hover:bg-zinc-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-zinc-900">
                                {dish.name}
                              </span>
                              {day.isCooked && (
                                <span className="text-xs text-emerald-600">✓</span>
                              )}
                              {day.kind === 'new' && (
                                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                  新菜
                                </span>
                              )}
                              {day.kind === 'review' && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  再练
                                </span>
                              )}
                              {isInSeason(dish, window) && (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                  应季
                                </span>
                              )}
                              <span className="text-xs text-zinc-400">
                                ⏱ {dish.minutes}min
                              </span>
                            </div>
                            <span className="text-zinc-300">›</span>
                          </div>
                          {note && (
                            <p className="mt-1 text-xs text-amber-600">
                              💡 上次：{note}
                            </p>
                          )}
                        </Link>
                        {!day.isCooked && (
                          <div className="mt-1 flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setCookModal({
                                  dishId: dish.id,
                                  dishName: dish.name,
                                  date: day.date,
                                })
                              }
                              className="btn btn-ghost text-[11px] text-emerald-600"
                            >
                              做过了
                            </button>
                            <button
                              type="button"
                              onClick={() => swapDish(idx)}
                              disabled={swapping}
                              className="btn btn-ghost text-[11px]"
                            >
                              {swapping ? '换菜中…' : '换一道'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-400">
                        暂无菜品
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 「做过了」评分弹窗（唯一入口组件） */}
      {cookModal && (
        <CookDoneModal
          dishId={cookModal.dishId}
          dishName={cookModal.dishName}
          date={cookModal.date}
          onClose={() => setCookModal(null)}
        />
      )}
    </div>
  );
}
