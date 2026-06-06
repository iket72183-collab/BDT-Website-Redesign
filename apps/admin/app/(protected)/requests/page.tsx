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

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = getCurrentUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = 20;

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(searchParams.search ? { search: searchParams.search } : {}),
    ...(searchParams.type ? { type: searchParams.type } : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
  });

  const res = await api<RequestRow[]>(`/api/admin/requests?${qs.toString()}`);

  return (
    <PageWrapper title="Requests" subtitle={`${res.meta?.total ?? 0} total`} user={user}>
      <RequestsTable
        rows={res.data}
        total={res.meta?.total ?? 0}
        page={page}
        limit={limit}
        search={searchParams.search ?? ''}
        type={searchParams.type ?? ''}
        status={searchParams.status ?? ''}
      />
    </PageWrapper>
  );
}
