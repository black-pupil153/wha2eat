import type { FridgeItem, ShoppingItem, WeekPlan } from '@/lib/types';
import { canonicalFoodName } from '@/lib/ingredients';

const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAYS_SHORT[d.getDay()];
}

/**
 * 解析数量字符串，提取数值和单位。
 * 例: "200g" → { value: 200, unit: "g" }
 *      "3个" → { value: 3, unit: "个" }
 *      "适量" → null
 */
function parseAmount(raw: string): { value: number; unit: string } | null {
  // 兼容生成器规范化前的 ":500g" / "：2个"
  const cleaned = raw.trim().replace(/^[：:]+/, '').trim();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: m[2].trim() };
}

/**
 * 同单位数值加总；单位不同或无法解析时保留原样拼接。
 */
function addAmounts(a: string, b: string): string {
  const pa = parseAmount(a);
  const pb = parseAmount(b);
  if (pa && pb && pa.unit === pb.unit) {
    const sum = pa.value + pb.value;
    const num = Number.isInteger(sum) ? sum.toString() : sum.toFixed(1);
    return `${num}${pa.unit}`;
  }
  return `${a} + ${b}`;
}

/** 菜单食材 − 冰箱 = 待购清单 */
export function computeShopping(
  weekPlan: WeekPlan,
  fridge: FridgeItem[]
): ShoppingItem[] {
  // 别名归一（西红柿=番茄），避免"冰箱有番茄但清单仍要买西红柿"
  const fridgeSet = new Set(
    fridge.map((n) => canonicalFoodName(n.name))
  );

  const merged = new Map<string, ShoppingItem>();
  const usageMap = new Map<string, string[]>();

  for (const day of weekPlan.days) {
    if (day.isTakeout || day.isCooked || !day.dishId) continue;
    const dish = weekPlan.dishes[day.dishId];
    if (!dish) continue;
    const label = `${dayLabel(day.date)} ${dish.name}`;
    for (const ing of dish.ingredients) {
      if (ing.category === '调味') continue; // 瓶罐调味默认已有；葱姜蒜归蔬菜，仍进采购
      const key = `${canonicalFoodName(ing.name)}__${ing.category}`;
      const existing = merged.get(key);
      if (existing) {
        existing.amount = addAmounts(existing.amount, ing.amount);
      } else {
        merged.set(key, {
          name: ing.name,
          amount: ing.amount,
          category: ing.category,
          checked: false,
        });
      }
      const usages = usageMap.get(key) ?? [];
      usages.push(label);
      usageMap.set(key, usages);
    }
  }

  const result: ShoppingItem[] = [];
  for (const [key, item] of merged) {
    if (fridgeSet.has(canonicalFoodName(item.name))) continue;
    const usages = usageMap.get(key) ?? [];
    if (usages.length >= 2) {
      item.suggestExtra = usages.join(' + ');
    }
    result.push(item);
  }
  return result;
}

/** 采购项稳定键：别名归一 + 分类（删除 tombstone / 勾选合并共用） */
export function shoppingItemKey(name: string, category: string): string {
  return `${canonicalFoodName(name)}__${category}`;
}

/** 合并勾选状态；列表内容未变时返回 prev 引用（勾选键走别名归一） */
export function mergeShoppingList(
  computed: ShoppingItem[],
  prev: ShoppingItem[]
): ShoppingItem[] {
  const prevChecked = new Map(
    prev.map((s) => [shoppingItemKey(s.name, s.category), s.checked])
  );
  const merged = computed.map((c) => ({
    ...c,
    checked: prevChecked.get(shoppingItemKey(c.name, c.category)) ?? false,
  }));
  const changed =
    merged.length !== prev.length ||
    merged.some(
      (m, i) =>
        canonicalFoodName(prev[i]?.name ?? '') !== canonicalFoodName(m.name) ||
        prev[i]?.category !== m.category ||
        prev[i]?.amount !== m.amount
    );
  return changed ? merged : prev;
}
