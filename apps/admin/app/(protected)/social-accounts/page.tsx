import { PageWrapper } from '@/components/layout/PageWrapper';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { SocialAccountsTable, type SocialAccountRow } from './SocialAccountsTable';

type SearchParams = {
  page?: string;
  search?: string;
  platform?: string;
  status?: string;
};

export default async function SocialAccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = 20;

  // platform + status are server-side (backend supports them); business-name
  // search is applied client-side over the loaded page (the admin list endpoint
  // has no `search` param yet — a future backend addition would make it
  // server-side + paginated like the requests table).
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.status ? { status: query.status } : {}),
  });

  const res = await api<SocialAccountRow[]>(`/api/admin/social-accounts?${qs.toString()}`);

  return (
    <PageWrapper title="Accounts" subtitle={`${res.meta?.total ?? 0} total`} user={user}>
      <SocialAccountsTable
        rows={res.data}
        total={res.meta?.total ?? 0}
        page={page}
        limit={limit}
        search={query.search ?? ''}
        platform={query.platform ?? ''}
        status={query.status ?? ''}
      />
    </PageWrapper>
  );
}
