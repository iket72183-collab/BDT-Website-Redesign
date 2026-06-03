import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LIMITED_REQUEST_TYPES, type RequestUsage } from '@bdt/shared-types';
import { RNBadge, RNButton, RNCard, RNSectionHeader } from '@/components/ui';
import { api } from '@/api/client';
import { palette, space, typography } from '@/styles/appTokens';
import { TYPE_LABEL } from '../requests/requestMeta';

interface PlanShape {
  id: 'premium';
  name: string;
  features: readonly string[];
}

interface TenantDetail {
  id: string;
  businessName: string;
  subscriptionTier: 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  googleBusinessUrl: string | null;
  plan: PlanShape;
}

/**
 * Client home — full offering hero, plan summary, website status, social
 * presence, and a prominent CTA into the messaging tab. Single-plan model:
 * every client is Premium, so there's no upgrade path or locked features.
 */
export function ClientDashboardScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api<{ data: TenantDetail }>('/api/tenant'),
    select: (r) => r.data,
  });

  const usage = useQuery({
    queryKey: ['requests', 'usage'],
    queryFn: () => api<{ data: RequestUsage }>('/api/requests/usage'),
    select: (r) => r.data,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.metal.rose} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn't load your dashboard.</Text>
        <RNButton label="Try again" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* --- Header --------------------------------------------------- */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>Welcome,</Text>
          <Text style={styles.businessName}>{data.businessName}</Text>
        </View>
        <RNBadge label={data.plan.name} tone="confirmed" />
      </View>

      {/* --- Hero ----------------------------------------------------- */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Your Digital Presence, Managed.</Text>
        <Text style={styles.heroSubtext}>
          Social media, website, creative assets and more — all in one place.
        </Text>
      </View>

      {/* --- Your Plan ------------------------------------------------ */}
      <RNSectionHeader title="Your Plan" />
      <RNCard framed>
        <Text style={styles.eyebrow}>WHAT'S INCLUDED</Text>
        <View style={{ gap: space[2], marginTop: space[3] }}>
          {data.plan.features.map((f) => (
            <FeatureLine key={f} text={f} />
          ))}
        </View>
      </RNCard>

      {/* --- This Month's Usage -------------------------------------- */}
      {usage.data && (
        <>
          <RNSectionHeader title="This Month's Usage" />
          <RNCard>
            <View style={{ gap: space[3] }}>
              {LIMITED_REQUEST_TYPES.map((t) => (
                <View key={t} style={styles.usageRow}>
                  <Text style={styles.usageLabel}>{TYPE_LABEL[t]}</Text>
                  <Text style={styles.usageValue}>
                    {usage.data![t].used} / {usage.data![t].limit}
                  </Text>
                </View>
              ))}
            </View>
          </RNCard>
        </>
      )}

      {/* --- Your Website -------------------------------------------- */}
      <RNSectionHeader title="Your Website" />
      <RNCard>
        {data.websiteUrl ? (
          <>
            <Text style={styles.url}>{data.websiteUrl}</Text>
            <View style={{ marginTop: space[4] }}>
              <RNButton
                label="Visit Website"
                variant="ghost"
                onPress={() => void Linking.openURL(data.websiteUrl!)}
                fullWidth
              />
            </View>
          </>
        ) : (
          <Text style={styles.muted}>Website coming soon — we're working on it!</Text>
        )}
      </RNCard>

      {/* --- Social Media -------------------------------------------- */}
      <RNSectionHeader title="Social Media" />
      <RNCard>
        <View style={{ gap: space[3] }}>
          <SocialLink label="Instagram" url={data.instagramUrl} />
          <SocialLink label="Facebook" url={data.facebookUrl} />
          <SocialLink label="TikTok" url={data.tiktokUrl} />
          <SocialLink label="Google Business" url={data.googleBusinessUrl} />
        </View>
      </RNCard>

      {/* --- CTA ------------------------------------------------------ */}
      <View style={{ marginTop: space[6] }}>
        <RNButton
          label="Send a Message"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => router.push('/(client)/messages' as never)}
        />
      </View>

      <View style={{ height: space[12] }} />
    </ScrollView>
  );
}

function FeatureLine({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.featureIn}>{text}</Text>
    </View>
  );
}

function SocialLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return <Text style={styles.muted}>{label}: not set up yet</Text>;
  }
  return (
    <View style={styles.socialRow}>
      <Text style={styles.socialLabel}>{label}</Text>
      <RNButton label="Open" size="sm" variant="ghost" onPress={() => void Linking.openURL(url)} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space[5],
    paddingTop: space[8],
    paddingBottom: space[8],
    gap: space[4],
  },
  center: {
    flex: 1,
    backgroundColor: palette.bg.base,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[4],
  },
  error: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    marginBottom: space[2],
  },
  welcome: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  businessName: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  hero: { gap: space[2] },
  heroTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  heroSubtext: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  eyebrow: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  check: {
    color: palette.metal.rose,
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyLG,
    width: 14,
  },
  featureIn: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
    flex: 1,
  },
  url: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
  },
  muted: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  socialLabel: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usageLabel: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  usageValue: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.metal.rose,
  },
});
