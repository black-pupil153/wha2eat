'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/AppProvider';

const NAV_ITEMS = [
  { href: '/plan', label: '今晚' },
  { href: '/fridge', label: '冰箱' },
  { href: '/shopping', label: '采购' },
  { href: '/history', label: '回溯' },
  { href: '/onboarding', label: '设置' },
];

export default function Nav() {
  const pathname = usePathname();
  const { ready, preferences } = useApp();

  // 未完成偏好设置时不显示导航
  if (!ready || !preferences) return null;

  return (
    <nav className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <Link href="/plan" className="text-base font-bold text-emerald-600 sm:text-lg">
          今晚吃什么
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
