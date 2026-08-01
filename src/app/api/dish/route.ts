import { NextResponse } from 'next/server';
import { generateSingleDish } from '@/lib/llm';
import { pickCatalogDishes } from '@/lib/catalog';
import { getSolarWindow } from '@/lib/solar';
import type { Preferences, FridgeItem } from '@/lib/types';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const preferences = body?.preferences as Preferences | undefined;
    const fridge = (body?.fridge as FridgeItem[] | undefined) ?? [];
    const excludeDishNames = (body?.excludeDishNames as string[] | undefined) ?? [];
    // mode: 'quick' 底库秒出（默认）；'ai' 强制 DeepSeek 定制
    const mode = body?.mode === 'ai' ? 'ai' : 'quick';

    if (!preferences) {
      return NextResponse.json(
        { error: '缺少 preferences 参数' },
        { status: 400 }
      );
    }

    if (mode === 'quick') {
      const window = getSolarWindow(localToday());
      const picked = pickCatalogDishes({
        preferences,
        fridge,
        excludeNames: excludeDishNames,
        count: 1,
        window,
      });
      if (picked.length > 0) {
        return NextResponse.json({ dish: picked[0] });
      }
      // 底库无候选（重忌口等）→ 落到 LLM
    }

    const dish = await generateSingleDish(preferences, fridge, excludeDishNames);
    return NextResponse.json({ dish: { ...dish, source: 'ai' } });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成菜品失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
