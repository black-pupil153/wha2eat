import { NextResponse } from 'next/server';
import { generateWeekPlan } from '@/lib/llm';
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

function dateFromIndex(start: Date, dayIndex: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().slice(0, 10);
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
  try {
    const body = await request.json();
    const preferences = body?.preferences as Preferences | undefined;
    const fridge = (body?.fridge as FridgeItem[] | undefined) ?? [];
    const recentDishes = (body?.recentDishes as string[] | undefined) ?? [];

    // ── 解析复习菜入参 ──
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
    // 复习菜数量不超过做饭天数
    const reviewCount = Math.min(reviewDishes.length, cookDays);
    const newCount = cookDays - reviewCount;

    // 构建 reviewNotes: dishId → 最新改进要点
    const reviewNotes: Record<string, string> = {};
    for (const rd of reviewDishes.slice(0, reviewCount)) {
      if (rd.notes) {
        reviewNotes[rd.dishId] = rd.notes;
      }
    }

    // 截取本轮实际复习菜
    const activeReviews = reviewDishes.slice(0, reviewCount);

    // ── 调用 LLM 只生成新菜 ──
    const dueDishesForLlm: DueDish[] = activeReviews.map((rd) => ({
      dishId: rd.dishId,
      dishName: rd.dishName,
      overdueDays: rd.overdueDays,
      lastCookedDate: rd.lastCookedDate,
      mastery: rd.mastery,
    }));

    const result = await generateWeekPlan(
      preferences,
      fridge,
      recentDishes,
      newCount,
      dueDishesForLlm,
      reviewNotes
    );

    // ── 合并：复习菜 + 新菜按日期交替排入 DayPlan ──
    const start = new Date();
    const allDishes: Record<string, Dish> = {};

    // 复习菜快照写入 dishes
    for (const rd of activeReviews) {
      allDishes[rd.dish.id] = rd.dish;
    }
    // 新菜写入 dishes
    for (const d of result.dishes) {
      allDishes[d.id] = d;
    }

    // 新菜按 LLM assignment 排序
    const newAssignments = [...result.assignments].sort(
      (a, b) => a.dayIndex - b.dayIndex
    );

    // 交替排列：偶数槽位(0,2,4…)放复习菜，剩余放新菜
    const days: DayPlan[] = [];
    let reviewIdx = 0;
    let newIdx = 0;

    for (let slot = 0; slot < cookDays; slot++) {
      const date = dateFromIndex(start, slot);

      if (reviewIdx < activeReviews.length && slot % 2 === 0) {
        // 复习菜占偶数槽位
        const rd = activeReviews[reviewIdx];
        days.push({
          date,
          dishId: rd.dish.id,
          isTakeout: false,
          kind: 'review',
        });
        reviewIdx++;
      } else if (newIdx < newAssignments.length) {
        // 新菜填充剩余槽位
        const a = newAssignments[newIdx];
        days.push({
          date,
          dishId: a.dishId,
          isTakeout: false,
          kind: 'new',
        });
        newIdx++;
      } else if (reviewIdx < activeReviews.length) {
        // 新菜用完了，剩余复习菜继续填入
        const rd = activeReviews[reviewIdx];
        days.push({
          date,
          dishId: rd.dish.id,
          isTakeout: false,
          kind: 'review',
        });
        reviewIdx++;
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

    // 附带周末标记便于前端展示
    const weekendFlags = days.map((d) => isWeekend(d.date));

    return NextResponse.json({ weekPlan, weekendFlags });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成菜单失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
