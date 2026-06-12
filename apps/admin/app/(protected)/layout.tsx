import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api';
import { USER_COOKIE, type AdminUser } from '@/lib/auth';

interface StatsResponse {
  unreadMessages: number;
}

/**
 * Shared shell for every authed admin route. Server-renders the sidebar
 * with a fresh unread-message count so the badge is right on first paint;
 * the user blob comes from the `bdt_admin_user` cookie that the login
 * page wrote.
 */
async function loadUser(): Promise<AdminUser | null> {
  const raw = (await cookies()).get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as AdminUser;
  } catch {
    return null;
  }
}

async function loadUnreadCount(): Promise<number> {
  try {
    const res = await api<StatsResponse>('/api/admin/stats');
    return res.data.unreadMessages ?? 0;
  } catch {
    return 0;
  }
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [user, unreadMessageCount] = await Promise.all([loadUser(), loadUnreadCount()]);

  return (
    <div className="flex h-screen">
      <Sidebar unreadMessageCount={unreadMessageCount} />
      <main className="flex-1 overflow-hidden bg-bg-base">
        {/* Each page renders its own PageWrapper so it can pass title/subtitle
            and still receive the user blob — passed down via a hidden header
            context-free, since user info doesn't change per route. */}
        <UserContext user={user}>{children}</UserContext>
      </main>
    </div>
  );
}

/**
 * Minimal context shim. Server components can't use React Context, but the
 * sub-pages are also server components and re-read the cookie themselves.
 * This wrapper just forwards children — kept as a seam if we later want a
 * client-side user provider.
 */
function UserContext({ children }: { user: AdminUser | null; children: React.ReactNode }) {
  return <>{children}</>;
}
