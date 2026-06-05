import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/api/client';

/**
 * Subscription state. Mirrors `/api/tenant/subscription` so the Plan tab can
 * render without an extra round trip. Single-plan model: one "Premium" plan at
 * $100/mo, no free trial, no tier upgrades. Connect / payouts are gone with the
 * pivot — BDT is not a marketplace.
 */

export type Tier = 'premium';

/**
 * Premium plan copy, mirrored from the API's `apps/api/src/lib/plans.ts`.
 * The mobile app can't import across the API package, so this is the
 * mobile-side source of truth for the plan price + feature list.
 */
export const PREMIUM_PLAN = {
  name: 'Premium',
  price: 100,
  features: [
    '4 AI-generated creative assets (flyers, promos, graphics, social visuals)',
    '12 social media requests (posts, captions, scheduling, engagement)',
    '4 website update requests (edits, fixes, maintenance, calendar updates)',
    '1 monthly performance report (social growth, website traffic, insights)',
    'Unlimited direct messaging to your BDT team',
    'Additional requests available at $25 each',
  ],
} as const;

export interface SubscriptionInfo {
  tier: Tier | null;
  // `trialing` is retained as a legacy status (no new trials are created).
  status: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled' | null;
  cancelAt: string | null;
}

interface StripeState {
  subscription: SubscriptionInfo;
  isLoading: boolean;
  error: string | null;

  fetchSubscription: () => Promise<void>;
  cancelSubscription: () => Promise<string | null>;
  openBillingPortal: () => Promise<void>;
  createSubscription: (input: { setupIntentId: string }) => Promise<void>;
  createSetupIntent: () => Promise<{ clientSecret: string }>;
}

const EMPTY: SubscriptionInfo = {
  tier: null,
  status: null,
  cancelAt: null,
};

export const useStripeStore = create<StripeState>((set, get) => ({
  subscription: EMPTY,
  isLoading: false,
  error: null,

  fetchSubscription: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api<{
        data: {
          subscriptionTier: Tier;
          subscriptionStatus: SubscriptionInfo['status'];
        };
      }>('/api/tenant/subscription');
      set({
        subscription: {
          tier: res.data.subscriptionTier,
          status: res.data.subscriptionStatus,
          cancelAt: null,
        },
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  cancelSubscription: async () => {
    const res = await api<{ data: { cancelAt: string | null } }>('/api/stripe/subscription', {
      method: 'DELETE',
    });
    set((s) => ({ subscription: { ...s.subscription, cancelAt: res.data.cancelAt } }));
    return res.data.cancelAt;
  },

  openBillingPortal: async () => {
    const res = await api<{ data: { url: string } }>('/api/stripe/billing-portal', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await WebBrowser.openBrowserAsync(res.data.url, { dismissButtonStyle: 'close' });
    await get().fetchSubscription();
  },

  createSubscription: async (input) => {
    await api('/api/stripe/subscription/create', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await get().fetchSubscription();
  },

  createSetupIntent: async () => {
    const res = await api<{ data: { clientSecret: string } }>('/api/stripe/setup-intent', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data;
  },
}));
