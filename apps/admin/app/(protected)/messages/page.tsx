import { PageWrapper } from '@/components/layout/PageWrapper';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { MessagesInbox, type MessageRow } from './MessagesInbox';

interface MessagesEnvelope {
  rows: MessageRow[];
  unreadCount: number;
}

type SearchParams = {
  status?: 'unread' | 'read';
  id?: string;
};

export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = getCurrentUser();
  const qs = new URLSearchParams({
    limit: '50',
    ...(searchParams.status ? { status: searchParams.status } : {}),
  });
  const res = await api<MessagesEnvelope>(`/api/admin/messages?${qs.toString()}`);

  return (
    <PageWrapper
      title="Messages"
      subtitle={`${res.data.unreadCount} unread · ${res.meta?.total ?? 0} total`}
      user={user}
    >
      <MessagesInbox
        messages={res.data.rows}
        initialStatus={searchParams.status ?? ''}
      />
    </PageWrapper>
  );
}
