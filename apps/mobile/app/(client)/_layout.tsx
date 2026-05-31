import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { palette, typography } from '@/styles/appTokens';

interface TenantDetail {
  onboardingCompleted: boolean;
}

/**
 * Client tab bar — Home / Message / Plan / Settings.
 *
 * Guards the onboarding gate: the (client) routes are only reachable after
 * the user has picked a plan + set up payment. Anyone landing here with
 * `onboardingCompleted = false` is bounced into (onboarding).
 */
export default function ClientLayout() {
  const { data } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api<{ data: TenantDetail }>('/api/tenant'),
    select: (r) => r.data,
  });

  // Pending-request count drives the Requests tab badge. Gated on completed
  // onboarding — /api/requests is behind requireSubscription, so querying it
  // pre-onboarding would just 403.
  const pending = useQuery({
    queryKey: ['requests', 'pending-count'],
    queryFn: () => api<{ data: { total: number } }>('/api/requests?status=pending&limit=1'),
    select: (r) => r.data.total,
    enabled: !!data?.onboardingCompleted,
  });
  const pendingCount = pending.data ?? 0;

  useEffect(() => {
    if (data && !data.onboardingCompleted) {
      router.replace('/(onboarding)/plan-selection' as never);
    }
  }, [data?.onboardingCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.bg.surface,
          borderTopColor: palette.metal.deep,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: palette.metal.rose,
        tabBarInactiveTintColor: palette.ink.subtle,
        tabBarLabelStyle: {
          fontFamily: typography.family.bodySemibold,
          fontSize: typography.size.label,
          letterSpacing: typography.tracking.label,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="messages" options={{ title: 'Message' }} />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
