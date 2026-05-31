'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

interface SidebarProps {
  unreadMessageCount?: number;
}

/**
 * Persistent left rail — visible on every protected route. Highlights the
 * current section by matching the leading path segment.
 *
 * Pass `unreadMessageCount` from the layout's server fetch so the Messages
 * row gets a numeric badge without an extra client round trip.
 */
export function Sidebar({ unreadMessageCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/clients',   label: 'Clients' },
    { href: '/requests',  label: 'Requests' },
    { href: '/social-accounts', label: 'Accounts' },
    { href: '/messages',  label: 'Messages', badge: unreadMessageCount },
    { href: '/revenue',   label: 'Revenue' },
    { href: '/settings',  label: 'Settings' },
  ];

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-metal-deep/30 bg-bg-surface">
      <div className="px-6 pb-2 pt-8">
        <p className="font-display text-2xl font-bold tracking-tight text-ink-primary">BDT</p>
        <p className="label mt-1">Connect Admin</p>
      </div>

      <nav className="mt-8 flex-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ' +
                (active
                  ? 'bg-metal-rose/10 text-metal-rose'
                  : 'text-ink-muted hover:bg-bg-raised hover:text-ink-primary')
              }
            >
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="rounded-full bg-metal-rose px-2 py-0.5 text-xs font-semibold text-ink-onMetal">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-metal-deep/30 px-6 py-4">
        <p className="text-xs text-ink-subtle">
          Internal use only. Do not share access.
        </p>
      </div>
    </aside>
  );
}
