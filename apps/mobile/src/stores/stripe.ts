import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/api/client';

/**
 * Subscription state. Mirrors `/api/tenant/subscription` (+ trial end) so
 * the Plan tab can render without an extra round trip. Connect / payouts
 * are gone with the pivot — BDT is not a marketplace.
 */

export type Tier = 'basic' | 'premium';

export interface SubscriptionInfo {
  tier: Tier | null;
  status: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled' | null;
  trialEnd: string | null;
  cancelAt: string | null;
  pendingTier: Tier | null;
  pendingTierEffectiveAt: string | null;
}

interface StripeState {
  subscription: SubscriptionInfo;
  isLoading: boolean;
  error: string | null;

  fetchSubscription: () => Promise<void>;
  upgradeTo: (tier: Tier) => Promise<void>;
  cancelSubscription: () => Promise<string | null>;
  openBillingPortal: () => Promise<void>;
  createSubscription: (input: { tier: Tier; setupIntentId: string }) => Promise<void>;
  createSetupIntent: () => Promise<{ clientSecret: string }>;
  /** Start a 14-day trial without capturing a card. Works whether or not the
   *  backend has Stripe configured — see apps/api/.../stripeService.startTrialWithoutCard. */
  startTrialWithoutCard: (tier: Tier) => Promise<void>;
}

const EMPTY: SubscriptionInfo = {
  tier: null,
  status: null,
  trialEnd: null,
  cancelAt: null,
  pendingTier: null,
  pendingTierEffectiveAt: null,
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
          trialEnd: string | null;
          pendingTier: Tier | null;
          pendingTierEffectiveAt: string | null;
        };
      }>('/api/tenant/subscription');
      set({
        subscription: {
          tier: res.data.subscriptionTier,
          status: res.data.subscriptionStatus,
          trialEnd: res.data.trialEnd,
          cancelAt: null,
          pendingTier: res.data.pendingTier,
          pendingTierEffectiveAt: res.data.pendingTierEffectiveAt,
        },
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  upgradeTo: async (tier) => {
    await api('/api/stripe/subscription/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
    await get().fetchSubscription();
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

  startTrialWithoutCard: async (tier) => {
    await api('/api/stripe/subscription/start-trial', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
    await get().fetchSubscription();
  },
}));
