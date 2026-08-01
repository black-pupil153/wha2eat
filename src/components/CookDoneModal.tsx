'use client';

// 「做过了」评分 + 改进笔记弹窗 —— 全 App 唯一入口组件，
// /plan 列表与 /dish 灶台模式共用，落库统一走 AppProvider.completeCook

import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import type { Rating } from '@/lib/types';

const RATING_OPTIONS: { value: Rating; label: string; emoji: string }[] = [
  { value: 1, label: '踩雷', emoji: '😖' },
  { value: 2, label: '一般', emoji: '😐' },
  { value: 3, label: '满意', emoji: '😋' },
];

interface Props {
  dishId: string;
  dishName: string;
  /** 做菜日期 YYYY-MM-DD（通常为当天菜单日期） */
  date: string;
  onClose: () => void;
  /** 提交成功后的回调（如跳回菜单页） */
  onDone?: () => void;
}

export default function CookDoneModal({ dishId, dishName, date, onClose, onDone }: Props) {
  const { completeCook } = useApp();
  const [rating, setRating] = useState<Rating | null>(null);
  const [note, setNote] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = () => {
    if (rating === null) return;
    const ok = completeCook({ dishId, date, rating, notes: note });
    if (!ok) {
      setSubmitError('找不到这道菜的数据，请返回菜单重试');
      return;
    }
    onClose();
    onDone?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-bold text-zinc-900">
          做过「{dishName}」了
        </h3>
        <p className="mt-1 text-sm text-zinc-500">打个分，下次做会带上你的笔记</p>

        <div className="mt-5 flex gap-3">
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRating(opt.value)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all ${
                rating === opt.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-zinc-700">
            改进要点（可选）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：盐减半、多放蒜…"
            rows={2}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        {submitError && (
          <p className="mt-3 text-sm text-red-600">{submitError}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={rating === null}
            className="btn btn-primary flex-1 disabled:opacity-50"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  );
}
