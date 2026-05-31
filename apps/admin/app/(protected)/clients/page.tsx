import { PageWrapper } from '@/components/layout/PageWrapper';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { ClientsTable } from './ClientsTable';

interface ClientRow {
  id: string;
  businessName: string;
  subscriptionTier: 'basic' | 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  createdAt: string;
  mrr: number;
  planName: string;
  owner: { firstName: string; lastName: string; email: string; phone: string | null } | null;
}

type SearchParams = {
  page?: string;
  search?: string;
  plan?: 'basic' | 'premium';
  status?: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  sort?: 'joined' | 'mrr' | 'name';
  order?: 'asc' | 'desc';
};

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = getCurrentUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = 20;

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(searchParams.search ? { search: searchParams.search } : {}),
    ...(searchParams.plan   ? { plan:   searchParams.plan }   : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
    ...(searchParams.sort   ? { sort:   searchParams.sort }   : { sort: 'joined' }),
    ...(searchParams.order  ? { order:  searchParams.order }  : { order: 'desc' }),
  });

  const res = await api<ClientRow[]>(`/api/admin/clients?${qs.toString()}`);

  return (
    <PageWrapper title="Clients" subtitle={`${res.meta?.total ?? 0} total`} user={user}>
      <ClientsTable
        rows={res.data}
        total={res.meta?.total ?? 0}
        page={page}
        limit={limit}
        search={searchParams.search ?? ''}
        plan={searchParams.plan ?? ''}
        status={searchParams.status ?? ''}
        sort={(searchParams.sort as 'joined' | 'mrr' | 'name') ?? 'joined'}
        order={(searchParams.order as 'asc' | 'desc') ?? 'desc'}
      />
    </PageWrapper>
  );
}
