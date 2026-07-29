'use client';

import { useRef, useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import type { WeekPlan, DayPlan } from '@/lib/types';

interface ShareCardProps {
  weekPlan: WeekPlan;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

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
      {/* 卡片预览区：固定 375×500（3:4 竖版，适合小红书） */}
      <div className="flex justify-center">
        <div
          ref={cardRef}
          className="w-[375px] bg-white"
          style={{ aspectRatio: '3/4' }}
        >
          {/* 头部 */}
          <div className="bg-zinc-900 px-6 py-8 text-white">
            <h2 className="text-2xl font-bold">🍽️ 本周菜单</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {new Date(weekPlan.days[0]?.date + 'T00:00:00').toLocaleDateString('zh-CN', {
                month: 'long',
              })}
              · 共 {validDays.length} 天
            </p>
          </div>

          {/* 菜单列表 */}
          <div className="space-y-0 divide-y divide-zinc-100 px-6 py-4">
            {weekPlan.days.map((day: DayPlan, idx: number) => {
              const dish = day.dishId ? weekPlan.dishes[day.dishId] : null;
              return (
                <div key={idx} className="flex items-start gap-3 py-3.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-400">
                      {formatDateLabel(day.date)}
                    </div>
                    {day.isTakeout || !dish ? (
                      <div className="mt-0.5 text-sm text-zinc-300">
                        外食 / 休息
                      </div>
                    ) : (
                      <>
                        <div className="mt-0.5 truncate text-sm font-semibold text-zinc-800">
                          {dish.name}
                        </div>
                        {dish.usesFridgeItems.length > 0 && (
                          <div className="mt-1 text-xs text-emerald-600">
                            消耗：{dish.usesFridgeItems.join('、')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部品牌 */}
          <div className="px-6 pb-6 pt-2">
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-zinc-700">
                今晚吃什么
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                AI 帮你决定每天吃什么
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 导出按钮 */}
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
