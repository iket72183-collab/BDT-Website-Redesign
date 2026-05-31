import type { ReactNode } from 'react';
import { Header } from './Header';

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  user?: { firstName: string; lastName: string; email: string } | null;
  children: ReactNode;
}

/**
 * Consistent shell for protected pages — header above, content below.
 * The sidebar lives in the route group layout; this wrapper sits inside it.
 */
export function PageWrapper({ title, subtitle, user, children }: PageWrapperProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header title={title} subtitle={subtitle} user={user} />
      <div className="flex-1 overflow-y-auto px-8 py-8">{children}</div>
    </div>
  );
}
