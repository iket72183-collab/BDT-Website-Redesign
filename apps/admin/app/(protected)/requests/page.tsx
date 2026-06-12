import { PageWrapper } from '@/components/layout/PageWrapper';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { RequestsTable, type RequestRow } from './RequestsTable';

type SearchParams = {
  page?: string;
  search?: string;
  type?:
    | 'website_update'
    | 'social_media'
    | 'general'
    | 'file_upload'
    | 'ai_creative'
    | 'report_request'
    | 'ai_consultation';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = 20;

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(query.search ? { search: query.search } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  });

  const res = await api<RequestRow[]>(`/api/admin/requests?${qs.toString()}`);

  return (
    <PageWrapper title="Requests" subtitle={`${res.meta?.total ?? 0} total`} user={user}>
      <RequestsTable
        rows={res.data}
        total={res.meta?.total ?? 0}
        page={page}
        limit={limit}
        search={query.search ?? ''}
        type={query.type ?? ''}
        status={query.status ?? ''}
      />
    </PageWrapper>
  );
}
