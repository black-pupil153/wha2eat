import { NextResponse } from 'next/server';
import { generateWeekPlan } from '@/lib/llm';
import { pickCatalogDishes } from '@/lib/catalog';
import { getSolarWindow } from '@/lib/solar';
import { checkRateLimit } from '@/lib/ratelimit';
import type {
  Preferences,
  FridgeItem,
  WeekPlan,
  DayPlan,
  Dish,
  DueDish,
} from '@/lib/types';

/** 请求体中的复习菜：DueDish 元信息 + Dish 快照 + 可选改进笔记 */
interface ReviewDishInput extends DueDish {
  dish: Dish;
  notes?: string;
}

/** 本地时区 YYYY-MM-DD（不用 toISOString，避免 UTC 偏移把"今天"算错） */
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateFromIndex(start: Date, dayIndex: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + dayIndex);
  return localDate(d);
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** 校验单个 ReviewDishInput 是否合法 */
function isValidReviewDish(r: unknown): r is ReviewDishInput {
  if (!r || typeof r !== 'object') return false;
  const obj = r as Record<string, unknown>;
  const dish = obj.dish;
  if (!dish || typeof dish !== 'object') return false;
  const d = dish as Record<string, unknown>;
  return (
    typeof obj.dishId === 'string' &&
    typeof obj.dishName === 'string' &&
    typeof d.id === 'string' &&
    typeof d.name === 'string'
  );
}

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
    const preferences = body?.preferences as Preferences | undefined;
    const fridge = (body?.fridge as FridgeItem[] | undefined) ?? [];
    const recentDishes = (body?.recentDishes as string[] | undefined) ?? [];

    const rawReviewDishes = (body?.reviewDishes as unknown[] | undefined) ?? [];
    const reviewDishes: ReviewDishInput[] = rawReviewDishes.filter(isValidReviewDish);

    if (!preferences) {
      return NextResponse.json(
        { error: '缺少 preferences 参数' },
        { status: 400 }
      );
    }
    if (
      typeof preferences.servings !== 'number' ||
      typeof preferences.cookDaysPerWeek !== 'number'
    ) {
      return NextResponse.json(
        { error: 'preferences 字段不合法' },
        { status: 400 }
      );
    }

    const cookDays = preferences.cookDaysPerWeek;
    const reviewCount = Math.min(reviewDishes.length, cookDays);
    const newCount = cookDays - reviewCount;
    const activeReviews = reviewDishes.slice(0, reviewCount);

    const today = localDate(new Date());
    const window = getSolarWindow(today);

    // ── 新菜：底库规则选菜为主（秒出、菜谱有底），LLM 只在候选不足时补位 ──
    const excludeNames = [
      ...recentDishes,
      ...activeReviews.map((rd) => rd.dishName),
    ];
    let newDishes: Dish[] = pickCatalogDishes({
      preferences,
      fridge,
      excludeNames,
      count: newCount,
      window,
    });

    if (newDishes.length < newCount) {
      // 底库不够（重忌口等极端情况）→ DeepSeek 补齐缺口
      const shortfall = newCount - newDishes.length;
      const reviewNotes: Record<string, string> = {};
      for (const rd of activeReviews) {
        if (rd.notes) reviewNotes[rd.dishId] = rd.notes;
      }
      const dueDishesForLlm: DueDish[] = activeReviews.map((rd) => ({
        dishId: rd.dishId,
        dishName: rd.dishName,
        overdueDays: rd.overdueDays,
        lastCookedDate: rd.lastCookedDate,
        mastery: rd.mastery,
      }));
      const llmResult = await generateWeekPlan(
        preferences,
        fridge,
        [...recentDishes, ...newDishes.map((d) => d.name)],
        shortfall,
        dueDishesForLlm,
        reviewNotes,
        today
      );
      newDishes = [...newDishes, ...llmResult.dishes.slice(0, shortfall)];
    }

    // ── 合并：复习菜占偶数槽，新菜填其余；周末槽优先放耗时长的新菜 ──
    const allDishes: Record<string, Dish> = {};
    for (const rd of activeReviews) allDishes[rd.dish.id] = rd.dish;
    for (const d of newDishes) allDishes[d.id] = d;

    const start = new Date();
    const slotDates = Array.from({ length: cookDays }, (_, i) =>
      dateFromIndex(start, i)
    );

    // 先确定复习槽位（偶数槽），剩余为新菜槽
    const reviewSlots: number[] = [];
    const newSlots: number[] = [];
    let reviewLeft = activeReviews.length;
    for (let slot = 0; slot < cookDays; slot++) {
      if (reviewLeft > 0 && slot % 2 === 0) {
        reviewSlots.push(slot);
        reviewLeft--;
      } else {
        newSlots.push(slot);
      }
    }

    // 新菜按耗时升序；周末新菜槽从耗时最长的开始分配
    const sortedNew = [...newDishes].sort((a, b) => a.minutes - b.minutes);
    const weekendNewSlots = newSlots.filter((s) => isWeekend(slotDates[s]));
    const weekdayNewSlots = newSlots.filter((s) => !isWeekend(slotDates[s]));
    const slotToDish = new Map<number, Dish>();
    for (const s of weekendNewSlots) {
      const dish = sortedNew.pop();
      if (dish) slotToDish.set(s, dish);
    }
    for (const s of weekdayNewSlots) {
      const dish = sortedNew.shift();
      if (dish) slotToDish.set(s, dish);
    }

    const days: DayPlan[] = [];
    let reviewIdx = 0;
    for (let slot = 0; slot < cookDays; slot++) {
      const date = slotDates[slot];
      if (reviewSlots.includes(slot)) {
        days.push({
          date,
          dishId: activeReviews[reviewIdx].dish.id,
          isTakeout: false,
          kind: 'review',
        });
        reviewIdx++;
      } else {
        const dish = slotToDish.get(slot);
        if (dish) {
          days.push({ date, dishId: dish.id, isTakeout: false, kind: 'new' });
        }
      }
    }

    const weekPlan: WeekPlan = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `plan-${Date.now()}`,
      createdAt: new Date().toISOString(),
      days,
      dishes: allDishes,
    };

    const weekendFlags = days.map((d) => isWeekend(d.date));

    return NextResponse.json({ weekPlan, weekendFlags });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成菜单失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
