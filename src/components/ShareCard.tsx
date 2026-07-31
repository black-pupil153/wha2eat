'use client';

import { useRef, useCallback, useState, useMemo } from 'react';
import { toPng } from 'html-to-image';
import type { WeekPlan, DayPlan, Mastery } from '@/lib/types';
import { getMastery } from '@/lib/review';
import { getSolarWindow, isInSeason } from '@/lib/solar';
import { storage } from '@/lib/storage';

interface ShareCardProps {
  weekPlan: WeekPlan;
}

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
  return `${m}/${day} ${wd}`;
}

export default function ShareCard({ weekPlan }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const solarWindow = useMemo(() => getSolarWindow(localToday()), []);

  const masteryStats = useMemo(() => {
    const records = storage.getCookRecords();
    const byDish = new Map<string, typeof records>();
    for (const r of records) {
      const arr = byDish.get(r.dishId) ?? [];
      arr.push(r);
      byDish.set(r.dishId, arr);
    }
    let mastered = 0;
    let learning = 0;
    let familiar = 0;
    for (const list of byDish.values()) {
      const m: Mastery = getMastery(list);
      if (m === 'mastered') mastered++;
      else if (m === 'familiar') familiar++;
      else learning++;
    }
    return { mastered, familiar, learning };
  }, []);

  const sampleNote = useMemo(() => {
    const records = storage.getCookRecords();
    const withNote = [...records]
      .filter((r) => r.notes?.trim())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return withNote[0]?.notes?.trim() ?? null;
  }, []);

  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `本周菜单-${new Date().toLocaleDateString('zh-CN')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('导出失败', e);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }, []);

  const validDays = weekPlan.days.filter(
    (d: DayPlan) => !d.isTakeout && d.dishId
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          ref={cardRef}
          className="flex w-[375px] flex-col overflow-hidden bg-white"
          style={{ aspectRatio: '3/4' }}
        >
          <div className="shrink-0 bg-zinc-900 px-5 py-5 text-white">
            <h2 className="text-xl font-bold leading-tight">本周菜单</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {new Date(weekPlan.days[0]?.date + 'T00:00:00').toLocaleDateString('zh-CN', {
                month: 'long',
              })}
              · 共 {validDays.length} 天
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-0 divide-y divide-zinc-100 overflow-hidden px-5 py-2">
            {weekPlan.days.map((day: DayPlan, idx: number) => {
              const dish = day.dishId ? weekPlan.dishes[day.dishId] : null;
              const seasonal = dish ? isInSeason(dish, solarWindow) : false;
              return (
                <div key={idx} className="flex items-start gap-2 py-2 leading-tight">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-zinc-400">
                      {formatDateLabel(day.date)}
                    </div>
                    {day.isTakeout || !dish ? (
                      <div className="mt-0.5 text-xs text-zinc-300">外食 / 休息</div>
                    ) : (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="truncate text-xs font-semibold text-zinc-800">
                          {dish.name}
                        </span>
                        {day.kind === 'new' && (
                          <span className="rounded bg-blue-50 px-1 text-[9px] text-blue-700">
                            新课
                          </span>
                        )}
                        {day.kind === 'review' && (
                          <span className="rounded bg-amber-50 px-1 text-[9px] text-amber-700">
                            复习
                          </span>
                        )}
                        {seasonal && (
                          <span className="rounded bg-emerald-50 px-1 text-[9px] text-emerald-700">
                            应季
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 space-y-2 px-5 pb-4 pt-1">
            <p className="text-center text-[10px] text-zinc-500">
              拿手 {masteryStats.mastered} 道 · 熟悉 {masteryStats.familiar} 道 · 学习中{' '}
              {masteryStats.learning} 道
            </p>
            {sampleNote && (
              <p className="line-clamp-2 text-center text-[10px] text-zinc-400">
                「{sampleNote}」
              </p>
            )}
            <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center">
              <p className="text-xs font-semibold text-zinc-700">今晚吃什么</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn btn-primary"
        >
          {exporting ? '导出中…' : '下载分享卡片'}
        </button>
      </div>
    </div>
  );
}
