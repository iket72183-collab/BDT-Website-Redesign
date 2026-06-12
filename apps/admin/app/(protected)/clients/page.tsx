import { PageWrapper } from '@/components/layout/PageWrapper';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { ClientsTable } from './ClientsTable';

interface ClientRow {
  id: string;
  businessName: string;
  subscriptionTier: 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  createdAt: string;
  mrr: number;
  planName: string;
  owner: { firstName: string; lastName: string; email: string; phone: string | null } | null;
}

type SearchParams = {
  page?: string;
  search?: string;
  plan?: 'premium';
  status?: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  sort?: 'joined' | 'mrr' | 'name';
  order?: 'asc' | 'desc';
};

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = 20;

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(query.search ? { search: query.search } : {}),
    ...(query.plan   ? { plan:   query.plan }   : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sort   ? { sort:   query.sort }   : { sort: 'joined' }),
    ...(query.order  ? { order:  query.order }  : { order: 'desc' }),
  });

  const res = await api<ClientRow[]>(`/api/admin/clients?${qs.toString()}`);

  return (
    <PageWrapper title="Clients" subtitle={`${res.meta?.total ?? 0} total`} user={user}>
      <ClientsTable
        rows={res.data}
        total={res.meta?.total ?? 0}
        page={page}
        limit={limit}
        search={query.search ?? ''}
        plan={query.plan ?? ''}
        status={query.status ?? ''}
        sort={(query.sort as 'joined' | 'mrr' | 'name') ?? 'joined'}
        order={(query.order as 'asc' | 'desc') ?? 'desc'}
      />
    </PageWrapper>
  );
}
