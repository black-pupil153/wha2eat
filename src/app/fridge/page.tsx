'use client';

import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { STOCK_LEVEL_OPTIONS, STOCK_LEVEL_LABEL } from '@/lib/constants';
import { sameFood } from '@/lib/ingredients';
import type { FridgeItem, StockLevel } from '@/lib/types';

export default function FridgePage() {
  const { ready, fridge, setFridge } = useApp();
  const [name, setName] = useState('');
  const [level, setLevel] = useState<StockLevel>('some');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkLevel, setBulkLevel] = useState<StockLevel>('some');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    );
  }

  const hasFood = (list: FridgeItem[], candidate: string) =>
    list.some((f) => sameFood(f.name, candidate));

  const addItem = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // 别名去重：已有「番茄」时不再加「西红柿」
    if (hasFood(fridge, trimmed)) {
      setName('');
      return;
    }
    const item: FridgeItem = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `f-${Date.now()}`,
      name: trimmed,
      level,
    };
    setFridge([...fridge, item]);
    setName('');
    setLevel('some');
  };

  const addBulk = () => {
    const names = bulkText
      .split(/[\n,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const next = [...fridge];
    const newItems: FridgeItem[] = [];
    for (const n of names) {
      if (hasFood(next, n)) continue;
      const item: FridgeItem = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `f-${Date.now()}-${n}`,
        name: n,
        level: bulkLevel,
      };
      newItems.push(item);
      next.push(item);
    }
    if (newItems.length > 0) {
      setFridge(next);
    }
    setBulkText('');
  };

  // 两人家庭常备食材一键填入（别名去重）
  const STARTER_ITEMS = [
    '鸡蛋', '西红柿', '土豆', '洋葱', '大蒜', '生姜',
    '小葱', '大米', '面条', '胡萝卜', '青椒', '豆腐',
  ];

  const addStarter = () => {
    const next = [...fridge];
    const newItems: FridgeItem[] = [];
    for (const n of STARTER_ITEMS) {
      if (hasFood(next, n)) continue;
      const item: FridgeItem = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `f-${Date.now()}-${n}`,
        name: n,
        level: 'some' as StockLevel,
      };
      newItems.push(item);
      next.push(item);
    }
    if (newItems.length > 0) {
      setFridge(next);
    }
  };

  const removeItem = (id: string) => {
    setFridge(fridge.filter((f) => f.id !== id));
  };

  const updateLevel = (id: string, newLevel: StockLevel) => {
    setFridge(fridge.map((f) => (f.id === id ? { ...f, level: newLevel } : f)));
  };

  const startEdit = (item: FridgeItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) {
      setFridge(
        fridge.map((f) => (f.id === editingId ? { ...f, name: trimmed } : f))
      );
    }
    setEditingId(null);
    setEditName('');
  };

  const expiring = fridge.filter((f) => f.level === 'expiring');

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">冰箱库存</h1>
        <p className="mt-1 text-sm text-zinc-500">
          「即将过期」的食材会在下次生成菜单时优先消耗。
        </p>
      </header>

      {expiring.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ {expiring.length} 样食材即将过期：{expiring.map((e) => e.name).join('、')}
        </div>
      )}

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">食材名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="如：番茄"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">数量档</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as StockLevel)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              {STOCK_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="btn btn-primary"
          >
            添加
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setBulkOpen(!bulkOpen)}
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-600"
        >
          <span>批量添加食材</span>
          <span className="text-zinc-400">{bulkOpen ? '收起 ▲' : '展开 ▼'}</span>
        </button>
        {bulkOpen && (
          <div className="mt-3 space-y-3">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`每行一个食材，或用逗号/顿号分隔\n例如：\n番茄\n鸡蛋\n土豆\n猪肉`}
              rows={5}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <div className="flex items-center justify-between">
              <select
                value={bulkLevel}
                onChange={(e) => setBulkLevel(e.target.value as StockLevel)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              >
                {STOCK_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addBulk} className="btn btn-primary">
                一键添加
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              支持换行、逗号、顿号分隔，自动去重
            </p>
          </div>
        )}
      </div>

      {fridge.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mb-2 text-4xl">🧊</div>
          <p className="text-sm text-zinc-400">冰箱还是空的（不填也能生成菜单）</p>
          <button
            type="button"
            onClick={addStarter}
            className="btn btn-primary mt-4"
          >
            一键填入两人常备食材
          </button>
          <p className="mt-2 text-xs text-zinc-400">
            {STARTER_ITEMS.join('、')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {fridge.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={confirmEdit}
                    autoFocus
                    className="w-24 rounded border border-emerald-400 px-2 py-0.5 text-sm outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="font-medium text-zinc-800 hover:text-emerald-600 hover:underline"
                    title="点击编辑名称"
                  >
                    {item.name}
                  </button>
                )}
                <select
                  value={item.level}
                  onChange={(e) => updateLevel(item.id, e.target.value as StockLevel)}
                  className={`rounded-full px-2 py-0.5 text-xs outline-none ${
                    item.level === 'expiring'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {STOCK_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {STOCK_LEVEL_LABEL[opt.value]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-sm text-zinc-400 hover:text-red-500"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
