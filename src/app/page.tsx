'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import type { Preferences, FridgeItem, WeekPlan, Dish, DayPlan, CookRecord } from '@/lib/types';

// ── 日期工具 ──
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── 演示偏好 ──
const DEMO_PREFERENCES: Preferences = {
  servings: 2,
  avoidances: ['辣'],
  tastes: ['清淡'],
  cookDaysPerWeek: 5,
  budget: 'mid',
};

// ── 演示冰箱（匹配 README）──
const DEMO_FRIDGE: FridgeItem[] = [
  { id: 'f1', name: '鸡蛋', level: 'plenty' },
  { id: 'f2', name: '西红柿', level: 'some' },
  { id: 'f3', name: '青椒', level: 'low' },
  { id: 'f4', name: '鸡胸肉', level: 'plenty' },
  { id: 'f5', name: '豆腐', level: 'expiring' },
  { id: 'f6', name: '土豆', level: 'some' },
  { id: 'f7', name: '大米', level: 'plenty' },
  { id: 'f8', name: '胡萝卜', level: 'some' },
  { id: 'f9', name: '洋葱', level: 'plenty' },
  { id: 'f10', name: '西兰花', level: 'low' },
];

// ── 演示菜谱库（10 道历史菜 + 5 道新课 + 2 道复习 = 15 道）──
function makeDemoDishLibrary(): Dish[] {
  return [
    // ── 拿手（mastered）──
    { id: 'dish-01', name: '番茄炒蛋', description: '经典家常菜，酸甜开胃，10分钟上桌', minutes: 10, costLevel: 'low', ingredients: [{ name: '鸡蛋', amount: '3个', category: '肉蛋' }, { name: '西红柿', amount: '2个', category: '蔬菜' }, { name: '食用油', amount: '适量', category: '调味' }], steps: ['西红柿切块', '鸡蛋打散', '先炒鸡蛋', '再炒西红柿', '混合翻炒'], usesFridgeItems: ['鸡蛋', '西红柿'] },
    { id: 'dish-02', name: '可乐鸡翅', description: '甜香浓郁，鸡翅嫩滑入味', minutes: 30, costLevel: 'mid', ingredients: [{ name: '鸡翅', amount: '8个', category: '肉蛋' }, { name: '可乐', amount: '1罐', category: '调味' }, { name: '生抽', amount: '2勺', category: '调味' }], steps: ['鸡翅划刀焯水', '锅中煎至金黄', '倒入可乐和生抽', '小火收汁'], usesFridgeItems: [] },
    { id: 'dish-03', name: '红烧肉', description: '肥而不腻，入口即化', minutes: 60, costLevel: 'mid', ingredients: [{ name: '五花肉', amount: '500g', category: '肉蛋' }, { name: '冰糖', amount: '30g', category: '调味' }, { name: '生抽', amount: '3勺', category: '调味' }, { name: '老抽', amount: '1勺', category: '调味' }], steps: ['五花肉切块焯水', '冰糖炒色', '加入肉块翻炒', '加水没过肉块', '小火炖40分钟'], usesFridgeItems: [] },
    // ── 熟悉（familiar）──
    { id: 'dish-04', name: '麻婆豆腐', description: '麻辣鲜香，下饭神器', minutes: 20, costLevel: 'low', ingredients: [{ name: '豆腐', amount: '1块', category: '肉蛋' }, { name: '猪肉末', amount: '100g', category: '肉蛋' }, { name: '花椒', amount: '适量', category: '调味' }, { name: '豆瓣酱', amount: '1勺', category: '调味' }], steps: ['豆腐切块焯水', '炒香肉末和豆瓣酱', '加入豆腐和少量水', '煮3分钟勾芡', '撒花椒粉'], usesFridgeItems: ['豆腐'] },
    { id: 'dish-05', name: '糖醋排骨', description: '酸甜适口，色泽红亮', minutes: 40, costLevel: 'mid', ingredients: [{ name: '排骨', amount: '400g', category: '肉蛋' }, { name: '醋', amount: '3勺', category: '调味' }, { name: '糖', amount: '2勺', category: '调味' }, { name: '生抽', amount: '2勺', category: '调味' }], steps: ['排骨焯水', '煎至两面金黄', '加糖醋生抽调味', '小火收汁'], usesFridgeItems: [] },
    { id: 'dish-06', name: '鱼香肉丝', description: '酸甜微辣，经典川味', minutes: 25, costLevel: 'mid', ingredients: [{ name: '猪肉丝', amount: '200g', category: '肉蛋' }, { name: '木耳', amount: '适量', category: '蔬菜' }, { name: '胡萝卜', amount: '1根', category: '蔬菜' }, { name: '青椒', amount: '1个', category: '蔬菜' }], steps: ['肉丝腌制', '调鱼香汁', '炒肉丝盛出', '炒配菜', '混合翻炒'], usesFridgeItems: ['胡萝卜', '青椒'] },
    // ── 学习中（learning）──
    { id: 'dish-07', name: '宫保鸡丁', description: '香辣酥脆，花生点睛', minutes: 20, costLevel: 'mid', ingredients: [{ name: '鸡胸肉', amount: '300g', category: '肉蛋' }, { name: '花生', amount: '50g', category: '其他' }, { name: '干辣椒', amount: '5个', category: '调味' }, { name: '葱段', amount: '适量', category: '蔬菜' }], steps: ['鸡丁腌制', '炸花生备用', '炒鸡丁至变色', '加干辣椒和葱段', '倒入花生翻匀'], usesFridgeItems: ['鸡胸肉'] },
    { id: 'dish-08', name: '蒜蓉西兰花', description: '清淡健康，蒜香提味', minutes: 15, costLevel: 'low', ingredients: [{ name: '西兰花', amount: '200g', category: '蔬菜' }, { name: '蒜末', amount: '3瓣', category: '调味' }], steps: ['西兰花焯水', '炒香蒜末', '加入西兰花翻炒', '调味出锅'], usesFridgeItems: ['西兰花'] },
    { id: 'dish-09', name: '青椒炒蛋', description: '快手素菜，营养均衡', minutes: 15, costLevel: 'low', ingredients: [{ name: '鸡蛋', amount: '2个', category: '肉蛋' }, { name: '青椒', amount: '2个', category: '蔬菜' }], steps: ['青椒切丝', '鸡蛋打散', '先炒蛋', '再炒青椒', '混合'], usesFridgeItems: ['鸡蛋', '青椒'] },
    { id: 'dish-10', name: '酸汤肥牛', description: '酸辣开胃，肥牛嫩滑', minutes: 20, costLevel: 'mid', ingredients: [{ name: '肥牛', amount: '300g', category: '肉蛋' }, { name: '西红柿', amount: '2个', category: '蔬菜' }, { name: '金针菇', amount: '100g', category: '蔬菜' }], steps: ['西红柿炒出汁', '加水煮沸', '下金针菇煮2分钟', '下肥牛涮熟'], usesFridgeItems: ['西红柿'] },
    // ── 本周新课（5 道）──
    { id: 'dish-n1', name: '清蒸鲈鱼', description: '鲜嫩清淡，蒸鱼豉油提味', minutes: 25, costLevel: 'mid', ingredients: [{ name: '鲈鱼', amount: '1条', category: '肉蛋' }, { name: '葱姜', amount: '适量', category: '蔬菜' }, { name: '蒸鱼豉油', amount: '2勺', category: '调味' }], steps: ['鲈鱼处理干净', '放葱姜蒸8分钟', '倒掉蒸汁', '淋蒸鱼豉油和热油'], usesFridgeItems: [] },
    { id: 'dish-n2', name: '蒜蓉菠菜', description: '补铁快手菜，3分钟搞定', minutes: 10, costLevel: 'low', ingredients: [{ name: '菠菜', amount: '300g', category: '蔬菜' }, { name: '蒜末', amount: '2瓣', category: '调味' }], steps: ['菠菜焯水', '炒香蒜末', '加入菠菜翻炒'], usesFridgeItems: [] },
    { id: 'dish-n3', name: '蛋炒饭', description: '粒粒分明，冰箱清库存利器', minutes: 15, costLevel: 'low', ingredients: [{ name: '大米', amount: '1碗', category: '主食' }, { name: '鸡蛋', amount: '2个', category: '肉蛋' }, { name: '胡萝卜', amount: '半根', category: '蔬菜' }, { name: '洋葱', amount: '半个', category: '蔬菜' }], steps: ['隔夜米饭备用', '炒散鸡蛋', '加入蔬菜丁翻炒', '倒入米饭炒匀'], usesFridgeItems: ['鸡蛋', '胡萝卜', '洋葱', '大米'] },
    { id: 'dish-n4', name: '凉拌黄瓜', description: '爽脆开胃，夏日必备', minutes: 10, costLevel: 'low', ingredients: [{ name: '黄瓜', amount: '2根', category: '蔬菜' }, { name: '蒜末', amount: '2瓣', category: '调味' }, { name: '醋', amount: '1勺', category: '调味' }], steps: ['黄瓜拍碎切段', '加蒜末、醋、盐拌匀'], usesFridgeItems: [] },
    { id: 'dish-n5', name: '冬瓜排骨汤', description: '清甜滋补，慢炖出鲜', minutes: 45, costLevel: 'mid', ingredients: [{ name: '排骨', amount: '300g', category: '肉蛋' }, { name: '冬瓜', amount: '300g', category: '蔬菜' }, { name: '姜片', amount: '3片', category: '调味' }], steps: ['排骨焯水', '加水放姜片大火煮开', '转小火炖30分钟', '加冬瓜再炖10分钟'], usesFridgeItems: [] },
  ];
}

// ── 演示做饭历史（10+ 道 CookRecord，覆盖三种掌握度）──
function makeDemoCookRecords(): CookRecord[] {
  let id = 1;
  const mk = (dishId: string, dishName: string, daysAgoN: number, rating: 1 | 2 | 3, note?: string): CookRecord => ({
    id: `cr-${id++}`,
    dishId,
    dishName,
    date: daysAgo(daysAgoN),
    rating,
    notes: note,
    createdAt: new Date(Date.now() - daysAgoN * 86400000).toISOString(),
  });

  return [
    // 番茄炒蛋：3次，拿手，最近5天前，未到期（21天间隔）
    mk('dish-01', '番茄炒蛋', 18, 3),
    mk('dish-01', '番茄炒蛋', 12, 3),
    mk('dish-01', '番茄炒蛋', 5, 3),
    // 可乐鸡翅：3次，拿手，最近5天前，note「可乐减半」
    mk('dish-02', '可乐鸡翅', 20, 2),
    mk('dish-02', '可乐鸡翅', 13, 3),
    mk('dish-02', '可乐鸡翅', 5, 3, '可乐减半'),
    // 红烧肉：4次，拿手，最近6天前，未到期
    mk('dish-03', '红烧肉', 25, 2),
    mk('dish-03', '红烧肉', 18, 3),
    mk('dish-03', '红烧肉', 12, 3),
    mk('dish-03', '红烧肉', 6, 3),
    // 麻婆豆腐：2次，熟悉，最近10天前，note「花椒多放半勺」，已到期（7天间隔）
    mk('dish-04', '麻婆豆腐', 17, 2),
    mk('dish-04', '麻婆豆腐', 10, 2, '花椒多放半勺'),
    // 糖醋排骨：2次，熟悉，最近10天前，已到期
    mk('dish-05', '糖醋排骨', 17, 2),
    mk('dish-05', '糖醋排骨', 10, 2),
    // 鱼香肉丝：2次，熟悉，最近11天前，note「木耳提前泡发」，已到期
    mk('dish-06', '鱼香肉丝', 18, 2),
    mk('dish-06', '鱼香肉丝', 11, 2, '木耳提前泡发'),
    // 宫保鸡丁：2次，学习中，踩雷，最近4天前，note「花生减半，辣度降一档」，已到期（踩雷2天间隔）
    mk('dish-07', '宫保鸡丁', 10, 2),
    mk('dish-07', '宫保鸡丁', 4, 1, '花生减半，辣度降一档'),
    // 蒜蓉西兰花：1次，学习中，最近5天前，note「蒜末最后放」，已到期（3天间隔）
    mk('dish-08', '蒜蓉西兰花', 5, 2, '蒜末最后放'),
    // 青椒炒蛋：1次，学习中，踩雷，最近4天前，note「青椒去籽减辣」，已到期（踩雷2天间隔）
    mk('dish-09', '青椒炒蛋', 4, 1, '青椒去籽减辣'),
    // 酸汤肥牛：1次，学习中，最近5天前，已到期（3天间隔）
    mk('dish-10', '酸汤肥牛', 5, 2),
  ];
}

// ── 演示一周课程表（5 新课 + 2 复习）──
function makeDemoWeekPlan(): WeekPlan {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  const library = makeDemoDishLibrary();
  const dishes: Record<string, Dish> = {};
  library.forEach((d) => { dishes[d.id] = d; });

  // 周一到周日：5 新课 + 2 复习 + 2 休息
  const schedule: { dayOffset: number; dishId: string | null; kind?: 'new' | 'review'; takeout: boolean }[] = [
    { dayOffset: 0, dishId: 'dish-n1', kind: 'new', takeout: false },     // 周一：清蒸鲈鱼（新课）
    { dayOffset: 1, dishId: 'dish-04', kind: 'review', takeout: false },   // 周二：麻婆豆腐（复习）
    { dayOffset: 2, dishId: 'dish-n2', kind: 'new', takeout: false },     // 周三：蒜蓉菠菜（新课）
    { dayOffset: 3, dishId: 'dish-n3', kind: 'new', takeout: false },     // 周四：蛋炒饭（新课）
    { dayOffset: 4, dishId: 'dish-07', kind: 'review', takeout: false },   // 周五：宫保鸡丁（复习）
    { dayOffset: 5, dishId: null, takeout: true },                         // 周六：休息
    { dayOffset: 6, dishId: null, takeout: true },                         // 周日：休息
  ];

  const days: DayPlan[] = schedule.map((s) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + s.dayOffset);
    return {
      date: d.toISOString().split('T')[0],
      dishId: s.dishId,
      isTakeout: s.takeout,
      kind: s.kind,
    };
  });

  return {
    id: 'demo-week-' + Date.now(),
    createdAt: new Date().toISOString(),
    days,
    dishes,
  };
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, preferences, setPreferences, setFridge, setWeekPlan, setCookRecords, setDishLibrary } = useApp();

  useEffect(() => {
    if (!ready) return;

    const isDemo = searchParams.get('demo') === '2';
    if (isDemo) {
      // 幂等：强制覆盖写入全部 demo 数据
      setPreferences(DEMO_PREFERENCES);
      setFridge(DEMO_FRIDGE);
      setCookRecords(makeDemoCookRecords());
      setDishLibrary(makeDemoDishLibrary());
      setWeekPlan(makeDemoWeekPlan());
      router.replace('/plan');
      return;
    }

    if (preferences) {
      router.replace('/plan');
    } else {
      router.replace('/onboarding');
    }
  }, [ready, preferences, searchParams, setPreferences, setFridge, setWeekPlan, setCookRecords, setDishLibrary, router]);

  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="animate-pulse text-zinc-400">加载中…</div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="animate-pulse text-zinc-400">加载中…</div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}
