'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { storage } from '@/lib/storage';
import { BUDGET_LABEL } from '@/lib/constants';
import type { Dish, CookRecord, Rating } from '@/lib/types';

const RATING_LABEL: Record<Rating, string> = {
  1: '😖 踩雷',
  2: '😐 一般',
  3: '😋 满意',
};

export default function DishDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, weekPlan, preferences } = useApp();

  // 菜谱库回退 + 历史笔记
  const [libraryDish, setLibraryDish] = useState<Dish | null>(null);
  const [cookRecords, setCookRecords] = useState<CookRecord[]>([]);

  useEffect(() => {
    // 加载历史烹饪记录
    setCookRecords(storage.getCookRecords());

    // 菜谱库回退：WeekPlan.dishes 找不到时查 dishLibrary
    if (weekPlan && params.id && !weekPlan.dishes[params.id]) {
      const lib = storage.getDishLibrary();
      const found = lib.find((d) => d.id === params.id) ?? null;
      setLibraryDish(found);
    }
  }, [weekPlan, params.id]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    );
  }

  const id = params.id;
  // 优先从当周 WeekPlan.dishes 取，找不到则回退菜谱库
  const dish: Dish | null =
    (id && weekPlan ? weekPlan.dishes[id] : null) ?? libraryDish;

  // 该菜的历史笔记（notes 不为空，按时间倒序）
  const historyNotes = cookRecords
    .filter((r) => r.dishId === id && r.notes && r.notes.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 text-sm text-zinc-500 hover:text-zinc-800"
      >
        ‹ 返回
      </button>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">{dish.name}</h1>
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
        </div>

        {dish.usesFridgeItems.length > 0 && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            优先消耗库存：{dish.usesFridgeItems.join('、')}
          </div>
        )}

        {/* 食材用量表 */}
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

        {/* 做法 */}
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
      </div>

      {/* 历史改进笔记 */}
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
