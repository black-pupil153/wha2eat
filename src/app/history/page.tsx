'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { getMastery } from '@/lib/review';
import type { CookRecord, Mastery, Rating } from '@/lib/types';

interface DishSummary {
  dishId: string;
  dishName: string;
  count: number;
  lastDate: string;
  mastery: Mastery;
  lastRating: Rating;
}

const MASTERY_CONFIG: Record<Mastery, { label: string; cls: string }> = {
  learning: { label: '学习中', cls: 'bg-zinc-100 text-zinc-600' },
  familiar: { label: '熟悉', cls: 'bg-sky-100 text-sky-700' },
  mastered: { label: '拿手', cls: 'bg-emerald-100 text-emerald-700' },
};

const RATING_EMOJI: Record<Rating, string> = {
  1: '😕',
  2: '😊',
  3: '😋',
};

function aggregate(records: CookRecord[]): DishSummary[] {
  const map = new Map<string, CookRecord[]>();
  for (const r of records) {
    const arr = map.get(r.dishId) ?? [];
    arr.push(r);
    map.set(r.dishId, arr);
  }
  const summaries: DishSummary[] = [];
  for (const [dishId, list] of map) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    summaries.push({
      dishId,
      dishName: last.dishName,
      count: list.length,
      lastDate: last.date,
      mastery: getMastery(list),
      lastRating: last.rating,
    });
  }
  // 按最近做过日期倒序
  return summaries.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function HistoryPage() {
  const records = storage.getCookRecords();
  const summaries = useMemo(() => aggregate(records), [records]);

  const totalDishes = summaries.length;
  const masteredCount = summaries.filter((s) => s.mastery === 'mastered').length;

  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold sm:text-2xl">吃菜回溯</h1>
          <p className="mt-1 text-sm text-zinc-500">回顾你做过的每一道菜</p>
        </header>
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mb-3 text-5xl">🍳</div>
          <p className="mb-1 font-medium text-zinc-700">还没有做菜记录</p>
          <p className="text-sm text-zinc-400">
            在菜单页点击「做过了」，就会在这里留下足迹
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">吃菜回溯</h1>
        <p className="mt-1 text-sm text-zinc-500">回顾你做过的每一道菜</p>
      </header>

      {/* 顶部统计 */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-zinc-800">{totalDishes}</div>
          <div className="mt-0.5 text-sm text-zinc-500">累计做过（道）</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{masteredCount}</div>
          <div className="mt-0.5 text-sm text-zinc-500">已拿手（道）</div>
        </div>
      </div>

      {/* 菜品列表 */}
      <div className="space-y-2">
        {summaries.map((s) => {
          const masteryCfg = MASTERY_CONFIG[s.mastery];
          return (
            <Link
              key={s.dishId}
              href={`/dish/${s.dishId}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-zinc-900">
                      {s.dishName}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${masteryCfg.cls}`}
                    >
                      {masteryCfg.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                    <span>做过 {s.count} 次</span>
                    <span>上次 {formatDate(s.lastDate)}</span>
                    <span title={`最近评分：${s.lastRating}`}>
                      {RATING_EMOJI[s.lastRating]} 最近评分 {s.lastRating}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-zinc-300">›</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
