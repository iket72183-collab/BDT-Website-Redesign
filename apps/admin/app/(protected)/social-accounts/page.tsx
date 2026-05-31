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

export default async function SocialAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = getCurrentUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = 20;

  // platform + status are server-side (backend supports them); business-name
  // search is applied client-side over the loaded page (the admin list endpoint
  // has no `search` param yet — a future backend addition would make it
  // server-side + paginated like the requests table).
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(searchParams.platform ? { platform: searchParams.platform } : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
  });

  const res = await api<SocialAccountRow[]>(`/api/admin/social-accounts?${qs.toString()}`);

  return (
    <PageWrapper title="Accounts" subtitle={`${res.meta?.total ?? 0} total`} user={user}>
      <SocialAccountsTable
        rows={res.data}
        total={res.meta?.total ?? 0}
        page={page}
        limit={limit}
        search={searchParams.search ?? ''}
        platform={searchParams.platform ?? ''}
        status={searchParams.status ?? ''}
      />
    </PageWrapper>
  );
}
