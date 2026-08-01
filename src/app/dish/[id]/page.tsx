'use client';

import { useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { BUDGET_LABEL } from '@/lib/constants';
import { getSolarWindow, isInSeason } from '@/lib/solar';
import type { Dish, Rating, WeekPlan } from '@/lib/types';
import CookDoneModal from '@/components/CookDoneModal';

const RATING_LABEL: Record<Rating, string> = {
  1: '😖 踩雷',
  2: '😐 一般',
  3: '😋 满意',
};

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DishDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    ready,
    weekPlan,
    preferences,
    setWeekPlan,
    upsertDish,
    cookRecords,
    dishLibrary,
  } = useApp();

  const [error, setError] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  const [revisedOverride, setRevisedOverride] = useState<{
    id: string;
    dish: Dish;
  } | null>(null);

  // ── 灶台模式（开做态）──
  const [cooking, setCooking] = useState(searchParams.get('cook') === '1');
  const [prepDone, setPrepDone] = useState<Set<number>>(new Set());
  const [stepsDone, setStepsDone] = useState<Set<number>>(new Set());
  const [showDoneModal, setShowDoneModal] = useState(false);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    );
  }

  const id = params.id;
  const planDish =
    id && weekPlan ? (weekPlan.dishes[id] ?? null) : null;
  const libraryDish =
    id && !planDish
      ? (dishLibrary.find((d) => d.id === id) ?? null)
      : null;
  const dish: Dish | null =
    (revisedOverride?.id === id ? revisedOverride.dish : null) ??
    planDish ??
    libraryDish;

  const dayKind = weekPlan?.days.find((d) => d.dishId === id)?.kind;
  const historyNotes = cookRecords
    .filter((r) => r.dishId === id && r.notes && r.notes.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lastNote = historyNotes[0]?.notes;
  const solarWindow = getSolarWindow(localToday());

  // 做菜记录归属日期：优先本周计划里排这道菜且未做的那天，否则今天
  const planDay = weekPlan?.days.find(
    (d) => d.dishId === id && !d.isCooked && !d.isTakeout
  );
  const recordDate = planDay?.date ?? localToday();

  const handleRevise = async () => {
    if (!dish) return;
    const notes = historyNotes
      .map((r) => r.notes)
      .filter((n): n is string => !!n && !!n.trim());
    if (notes.length === 0) {
      setError('还没有改进要点，先在「做过了」里记一条吧');
      return;
    }
    setRevising(true);
    setError(null);
    try {
      const res = await fetch('/api/dish/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish, notes }),
      });
      const data = (await res.json()) as { dish?: Dish; error?: string };
      if (!res.ok || !data.dish) {
        throw new Error(data.error || '重新生成失败，请稍后重试');
      }
      const revised = data.dish;
      upsertDish(revised);
      setRevisedOverride({ id: revised.id, dish: revised });
      if (weekPlan?.dishes[revised.id]) {
        const updated: WeekPlan = {
          ...weekPlan,
          dishes: { ...weekPlan.dishes, [revised.id]: revised },
        };
        setWeekPlan(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '重新生成失败');
    } finally {
      setRevising(false);
    }
  };

  if (!dish) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="mb-3 text-5xl">🤔</div>
        <p className="mb-4 font-medium text-zinc-700">找不到这道菜</p>
        <p className="mb-5 text-sm text-zinc-400">
          它可能来自已重新生成的旧菜单，缓存已失效。
        </p>
        <Link href="/plan" className="btn btn-primary">
          返回菜单
        </Link>
      </div>
    );
  }

  const toggleSet = (
    set: Set<number>,
    setter: (s: Set<number>) => void,
    i: number
  ) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setter(next);
  };

  // ── 灶台模式视图 ──
  if (cooking) {
    const currentStep = dish.steps.findIndex((_, i) => !stepsDone.has(i));
    return (
      <div className="mx-auto max-w-3xl px-3 py-4 pb-28 sm:px-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCooking(false)}
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ‹ 退出灶台模式
          </button>
          <span className="text-xs text-zinc-400">⏱ 约 {dish.minutes} 分钟</span>
        </div>

        <h1 className="text-2xl font-bold text-zinc-900">{dish.name}</h1>

        {lastNote && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            💡 上次你说：{lastNote}
          </div>
        )}

        {/* 备菜清单 */}
        <section className="mt-5">
          <h2 className="mb-2 text-base font-semibold text-zinc-800">
            🧺 备菜清单
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {prepDone.size}/{dish.ingredients.length}
            </span>
          </h2>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {dish.ingredients.map((ing, i) => (
              <li key={`${ing.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => toggleSet(prepDone, setPrepDone, i)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    prepDone.has(i)
                      ? 'border-emerald-200 bg-emerald-50 text-zinc-400 line-through'
                      : 'border-zinc-200 bg-white text-zinc-800'
                  }`}
                >
                  <span>
                    {prepDone.has(i) ? '✓ ' : ''}
                    {ing.name}
                  </span>
                  <span className="text-xs text-zinc-400">{ing.amount}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 分步做法（点一步完成一步） */}
        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold text-zinc-800">
            🔥 跟着做
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {stepsDone.size}/{dish.steps.length} 步
            </span>
          </h2>
          <ol className="space-y-2">
            {dish.steps.map((step, i) => {
              const done = stepsDone.has(i);
              const isCurrent = i === currentStep;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleSet(stepsDone, setStepsDone, i)}
                    className={`flex w-full gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      done
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : isCurrent
                          ? 'border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500/30'
                          : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <p
                      className={`pt-0.5 text-sm leading-relaxed ${
                        done ? 'text-zinc-400 line-through' : 'text-zinc-700'
                      }`}
                    >
                      {step}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 底部固定：做完收尾 */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <span className="text-xs text-zinc-400">
              {stepsDone.size === dish.steps.length
                ? '全部完成 🎉'
                : `进行到第 ${Math.max(currentStep + 1, 1)} 步`}
            </span>
            <button
              type="button"
              onClick={() => setShowDoneModal(true)}
              className="btn btn-primary flex-1 text-base font-bold"
            >
              做完了，打个分
            </button>
          </div>
        </div>

        {showDoneModal && (
          <CookDoneModal
            dishId={dish.id}
            dishName={dish.name}
            date={recordDate}
            onClose={() => setShowDoneModal(false)}
            onDone={() => router.push('/plan')}
          />
        )}
      </div>
    );
  }

  // ── 档案视图 ──
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 text-sm text-zinc-500 hover:text-zinc-800"
      >
        ‹ 返回
      </button>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {dayKind === 'review' && lastNote && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          上次你说：{lastNote}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900">{dish.name}</h1>
          {isInSeason(dish, solarWindow) && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              应季
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">{dish.description}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-full bg-zinc-100 px-3 py-1">
            ⏱ {dish.minutes} 分钟
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1">
            💰 {BUDGET_LABEL[dish.costLevel]}预算
          </span>
          {preferences && (
            <span className="rounded-full bg-zinc-100 px-3 py-1">
              👥 {preferences.servings} 人份
            </span>
          )}
          {dish.source === 'howtocook' && (
            <span className="rounded-full bg-zinc-100 px-3 py-1">
              📖 菜谱来自 HowToCook
            </span>
          )}
          {(dish.solarTerms ?? []).map((t) => (
            <span
              key={t}
              className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"
            >
              {t}
            </span>
          ))}
        </div>

        {dish.usesFridgeItems.length > 0 && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            优先消耗库存：{dish.usesFridgeItems.join('、')}
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setCooking(true)}
            className="btn btn-primary w-full text-base font-bold"
          >
            🔥 开始做这道菜
          </button>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">食材用量</h2>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-100">
            {dish.ingredients.map((ing, i) => (
              <li
                key={`${ing.name}-${i}`}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="flex items-center gap-2">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                    {ing.category}
                  </span>
                  <span className="text-zinc-800">{ing.name}</span>
                </span>
                <span className="text-sm text-zinc-500">{ing.amount}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">分步做法</h2>
          <ol className="space-y-3">
            {dish.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm leading-relaxed text-zinc-700">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleRevise}
            disabled={revising}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {revising ? '正在按笔记重写做法…' : '按改进要点重新生成做法'}
          </button>
        </div>
      </div>

      {historyNotes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-zinc-800">
            📝 历史笔记
            <span className="ml-2 text-sm font-normal text-zinc-400">
              {historyNotes.length} 条
            </span>
          </h2>
          <ul className="space-y-2">
            {historyNotes.map((record) => (
              <li
                key={record.id}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">
                    {record.date}
                  </span>
                  <span className="text-sm">
                    {RATING_LABEL[record.rating]}
                  </span>
                </div>
                {record.notes && (
                  <p className="mt-1.5 text-sm text-zinc-600">
                    {record.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function DishDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="animate-pulse text-zinc-400">加载中…</div>
        </div>
      }
    >
      <DishDetailInner />
    </Suspense>
  );
}
