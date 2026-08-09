import { NextResponse } from 'next/server';
import { generateSingleDish } from '@/lib/llm';
import { pickCatalogDishes } from '@/lib/catalog';
import { getSolarWindow } from '@/lib/solar';
import { checkRateLimit } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/client-ip';
import { clientErrorMessage, isAiModeAllowed } from '@/lib/api-error';
import { isValidPreferenceRanges } from '@/lib/validate-preferences';
import type { Preferences, FridgeItem } from '@/lib/types';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '请求太频繁，请稍后再试' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const preferences = body?.preferences as Preferences | undefined;
    const fridge = (body?.fridge as FridgeItem[] | undefined) ?? [];
    const excludeDishNames =
      (body?.excludeDishNames as string[] | undefined) ?? [];
    // mode: 'quick' 底库秒出（默认）；'ai' 强制 DeepSeek 定制（需令牌）
    const mode = body?.mode === 'ai' ? 'ai' : 'quick';

    if (!preferences) {
      return NextResponse.json(
        { error: '缺少 preferences 参数' },
        { status: 400 }
      );
    }
    if (!isValidPreferenceRanges(preferences)) {
      return NextResponse.json(
        { error: 'preferences 字段不合法' },
        { status: 400 }
      );
    }

    if (mode === 'ai' && !isAiModeAllowed(request.headers)) {
      return NextResponse.json(
        { error: '无权使用 AI 定制' },
        { status: 403 }
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

    const dish = await generateSingleDish(
      preferences,
      fridge,
      excludeDishNames
    );
    return NextResponse.json({ dish: { ...dish, source: 'ai' } });
  } catch (e) {
    return NextResponse.json(
      { error: clientErrorMessage(e, '生成菜品失败') },
      { status: 500 }
    );
  }
}
