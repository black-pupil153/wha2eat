import { NextResponse } from 'next/server';
import { generateSingleDish } from '@/lib/llm';
import type { Preferences, FridgeItem } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const preferences = body?.preferences as Preferences | undefined;
    const fridge = (body?.fridge as FridgeItem[] | undefined) ?? [];
    const excludeDishNames = (body?.excludeDishNames as string[] | undefined) ?? [];

    if (!preferences) {
      return NextResponse.json(
        { error: '缺少 preferences 参数' },
        { status: 400 }
      );
    }

    const dish = await generateSingleDish(preferences, fridge, excludeDishNames);
    return NextResponse.json({ dish });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成菜品失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
