import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RNBadge, RNButton, RNCard, RNSectionHeader } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';

interface PlanShape {
  id: 'basic' | 'premium';
  name: string;
  features: readonly string[];
  notIncluded: readonly string[];
}

interface TenantDetail {
  id: string;
  businessName: string;
  subscriptionTier: 'basic' | 'premium';
  subscriptionStatus: 'incomplete' | 'active' | 'trialing' | 'past_due' | 'cancelled';
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  googleBusinessUrl: string | null;
  plan: PlanShape;
  trialEnd: string | null;
}

/**
 * Client home — shows plan summary, current website status, social presence
 * (premium-only), and a prominent CTA into the messaging tab.
 */
export function ClientDashboardScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api<{ data: TenantDetail }>('/api/tenant'),
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

  const isPremium = data.subscriptionTier === 'premium';
  const isTrialing = data.subscriptionStatus === 'trialing';
  const trialDaysLeft = data.trialEnd ? daysUntil(data.trialEnd) : null;

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

      {isTrialing && trialDaysLeft !== null && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialText}>
            Your free trial ends in {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}
          </Text>
          {!isPremium && (
            <RNButton
              label="Upgrade to Premium"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(client)/plan' as never)}
            />
          )}
        </View>
      )}

      {/* --- Your Plan ------------------------------------------------ */}
      <RNSectionHeader title="Your Plan" />
      <RNCard framed>
        <Text style={styles.eyebrow}>WHAT'S INCLUDED</Text>
        <View style={{ gap: space[2], marginTop: space[3] }}>
          {data.plan.features.map((f) => (
            <FeatureLine key={f} text={f} included />
          ))}
          {data.plan.notIncluded.map((f) => (
            <FeatureLine key={f} text={f} included={false} />
          ))}
        </View>
        {!isPremium && (
          <View style={{ marginTop: space[5] }}>
            <RNButton
              label="Upgrade"
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => router.push('/(client)/plan' as never)}
            />
          </View>
        )}
      </RNCard>

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
          <Text style={styles.muted}>
            Website coming soon — we're working on it!
          </Text>
        )}
      </RNCard>

      {/* --- Social Media (premium only) ----------------------------- */}
      <RNSectionHeader title="Social Media" />
      <RNCard>
        {isPremium ? (
          <View style={{ gap: space[3] }}>
            <SocialLink label="Instagram" url={data.instagramUrl} />
            <SocialLink label="Facebook" url={data.facebookUrl} />
            <SocialLink label="TikTok" url={data.tiktokUrl} />
            <SocialLink label="Google Business" url={data.googleBusinessUrl} />
          </View>
        ) : (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>🔒 Premium feature</Text>
            <Text style={styles.muted}>
              Upgrade to Premium to unlock social media management.
            </Text>
          </View>
        )}
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

function FeatureLine({ text, included }: { text: string; included: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Text style={included ? styles.check : styles.cross}>{included ? '✓' : '✗'}</Text>
      <Text style={included ? styles.featureIn : styles.featureOut}>{text}</Text>
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

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
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
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    backgroundColor: palette.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: palette.metal.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  trialText: {
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodyMD,
    color: palette.metal.rose,
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
  cross: {
    color: palette.ink.subtle,
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
  featureOut: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.subtle,
    textDecorationLine: 'line-through',
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
  lockedCard: { gap: space[2] },
  lockedTitle: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
  },
});
