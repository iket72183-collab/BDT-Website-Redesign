import { create } from 'zustand';
import type { Tenant } from '@bdt/shared-types';
import { storage } from '@/lib/storage';

interface TenantState {
  slug: string | null;
  tenant: Tenant | null;
  setSlug: (slug: string | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  hydrate: () => Promise<void>;
}

const SLUG_KEY = 'tenant.slug';

export const useTenantStore = create<TenantState>((set) => ({
  slug: null,
  tenant: null,
  setSlug: (slug) => {
    if (slug) void storage.set(SLUG_KEY, slug);
    else void storage.delete(SLUG_KEY);
    set({ slug });
  },
  setTenant: (tenant) => set({ tenant }),
  hydrate: async () => {
    const slug = await storage.get(SLUG_KEY);
    set({ slug });
  },
}));
