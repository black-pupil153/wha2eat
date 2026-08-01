'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import {
  AVOIDANCE_OPTIONS,
  TASTE_OPTIONS,
  BUDGET_OPTIONS,
} from '@/lib/constants';
import type { Budget, Preferences } from '@/lib/types';

function TagOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-zinc-300 text-zinc-600 hover:border-emerald-400'
      }`}
    >
      {label}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, preferences, setPreferences } = useApp();

  const [servings, setServings] = useState(2);
  const [avoidances, setAvoidances] = useState<string[]>([]);
  const [customAvoidance, setCustomAvoidance] = useState('');
  const [tastes, setTastes] = useState<string[]>([]);
  const [cookDaysPerWeek, setCookDaysPerWeek] = useState(5);
  const [budget, setBudget] = useState<Budget>('mid');
  const [showMore, setShowMore] = useState(false);

  // 从已保存的偏好恢复（编辑场景）
  useEffect(() => {
    if (!ready) return;
    if (preferences) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 context 水合本地表单状态
      setServings(preferences.servings);
      setAvoidances(preferences.avoidances);
      setTastes(preferences.tastes);
      setCookDaysPerWeek(preferences.cookDaysPerWeek);
      setBudget(preferences.budget);
    }
  }, [ready, preferences]);

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    value: string
  ) => {
    setList(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value]
    );
  };

  const handleSave = () => {
    const finalAvoidances = [...avoidances];
    if (customAvoidance.trim()) {
      customAvoidance
        .split(/[、,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          if (!finalAvoidances.includes(s)) finalAvoidances.push(s);
        });
    }
    const prefs: Preferences = {
      servings,
      avoidances: finalAvoidances,
      tastes,
      cookDaysPerWeek,
      budget,
    };
    setPreferences(prefs);
    router.push('/plan');
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">
          {preferences ? '偏好设置' : '两步开吃'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {preferences
            ? '数据保存在本地，刷新不丢。'
            : '告诉我几个人吃、忌什么口，其余都有默认值，之后随时能改。'}
        </p>
      </header>

      <div className="space-y-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        {/* 就餐人数 */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            就餐人数
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={6}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
            />
            <span className="w-12 text-center text-lg font-bold text-emerald-600">
              {servings}
            </span>
          </div>
        </div>

        {/* 忌口 */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            忌口 / 过敏原
          </label>
          <div className="flex flex-wrap gap-2">
            {AVOIDANCE_OPTIONS.map((opt) => (
              <TagOption
                key={opt}
                label={opt}
                active={avoidances.includes(opt)}
                onClick={() => toggle(avoidances, setAvoidances, opt)}
              />
            ))}
          </div>
          <input
            type="text"
            value={customAvoidance}
            onChange={(e) => setCustomAvoidance(e.target.value)}
            placeholder="自定义忌口（用顿号/逗号分隔）"
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        {/* 更多偏好（可选，默认折叠降低启动门槛） */}
        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700"
          >
            更多偏好（口味 / 天数 / 预算，可不填）
            <span className="text-xs">{showMore ? '▾' : '▸'}</span>
          </button>
          {!showMore && (
            <p className="mt-1 text-xs text-zinc-400">
              当前：每周 {cookDaysPerWeek} 天 ·{' '}
              {tastes.length ? tastes.join('、') : '口味不限'} ·{' '}
              {BUDGET_OPTIONS.find((b) => b.value === budget)?.label}预算
            </p>
          )}
        </div>

        {showMore && (
          <>
            {/* 口味偏好 */}
            <div>
              <label className="mb-2 block text-sm font-medium">口味偏好</label>
              <div className="flex flex-wrap gap-2">
                {TASTE_OPTIONS.map((opt) => (
                  <TagOption
                    key={opt}
                    label={opt}
                    active={tastes.includes(opt)}
                    onClick={() => toggle(tastes, setTastes, opt)}
                  />
                ))}
              </div>
            </div>

            {/* 每周做饭天数 */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                每周做饭天数
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={3}
                  max={7}
                  value={cookDaysPerWeek}
                  onChange={(e) => setCookDaysPerWeek(Number(e.target.value))}
                  className="flex-1 accent-emerald-600"
                />
                <span className="w-12 text-center text-lg font-bold text-emerald-600">
                  {cookDaysPerWeek}
                </span>
              </div>
            </div>

            {/* 预算 */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                单餐预算档
              </label>
              <div className="flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map((opt) => (
                  <TagOption
                    key={opt.value}
                    label={opt.label}
                    active={budget === opt.value}
                    onClick={() => setBudget(opt.value)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="btn btn-primary w-full text-base font-bold"
        >
          {preferences ? '保存' : '开始安排今晚 →'}
        </button>
      </div>
    </div>
  );
}
