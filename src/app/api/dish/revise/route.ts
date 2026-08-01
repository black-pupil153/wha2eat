import { NextResponse } from 'next/server';
import { reviseDish } from '@/lib/llm';
import { checkRateLimit } from '@/lib/ratelimit';
import type { Dish } from '@/lib/types';

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '请求太频繁，请稍后再试' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const dish = body?.dish as Dish | undefined;
    const notes = (body?.notes as string[] | undefined) ?? [];

    if (!dish || typeof dish.id !== 'string' || typeof dish.name !== 'string') {
      return NextResponse.json({ error: '缺少合法 dish 参数' }, { status: 400 });
    }

    const revised = await reviseDish(dish, notes);
    return NextResponse.json({ dish: revised });
  } catch (e) {
    const message = e instanceof Error ? e.message : '修订菜谱失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
