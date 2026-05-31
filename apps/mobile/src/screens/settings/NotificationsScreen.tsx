import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppHeader } from '@/components/AppHeader';
import { Icon, RNCard, RNEmptyState, RNSectionHeader, RNSkeleton } from '@/components/ui';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthStore } from '@/stores/auth';
import { api, ApiError } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';

interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  marketing: boolean;
}

interface DevicePushToken {
  id: string;
  token: string;
  platform: string;
  deviceName: string | null;
  isActive: boolean;
  lastSeenAt: string;
}

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface Envelope<T> { success: boolean; data: T }

export function NotificationsScreen() {
  const user = useAuthStore((s) => s.user);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [tokens, setTokens] = useState<DevicePushToken[]>([]);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');

  const { deregisterTokenWithServer } = usePushNotifications();

  useEffect(() => {
    void (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status as PermissionStatus);
    })();

    void (async () => {
      try {
        const res = await api<Envelope<NotificationPreferences>>(
          '/api/notifications/preferences',
        );
        setPreferences(res.data);
      } catch {
        // Leave null — the UI just doesn't render the toggle sections.
      } finally {
        setIsLoadingPrefs(false);
      }
    })();

    void (async () => {
      try {
        const res = await api<Envelope<DevicePushToken[]>>('/api/push/tokens');
        setTokens(res.data);
      } catch {
        // Empty list falls through to the empty state.
      } finally {
        setIsLoadingTokens(false);
      }
    })();
  }, []);

  const updatePreference = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      setPreferences((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        const res = await api<Envelope<NotificationPreferences>>(
          '/api/notifications/preferences',
          { method: 'PATCH', body: JSON.stringify(patch) },
        );
        setPreferences(res.data);
      } catch (err) {
        // Rollback by re-fetching authoritative state.
        try {
          const res = await api<Envelope<NotificationPreferences>>(
            '/api/notifications/preferences',
          );
          setPreferences(res.data);
        } catch {
          // ignore — surface the original error to the user
        }
        Alert.alert(
          'Failed to update preference',
          err instanceof ApiError ? err.message : 'Please try again.',
        );
      }
    },
    [],
  );

  const handleMasterToggle = (next: boolean) => {
    if (!next) {
      Alert.alert(
        'Disable push notifications?',
        "You won't receive replies from BDT or account updates.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => void updatePreference({ pushEnabled: false }),
          },
        ],
      );
      return;
    }
    void updatePreference({ pushEnabled: true });
  };

  const handleRemoveDevice = (tk: DevicePushToken) => {
    Alert.alert(
      'Remove this device?',
      'Push notifications will stop on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const prev = tokens;
            setTokens((list) => list.filter((x) => x.id !== tk.id));
            deregisterTokenWithServer(tk.token).catch((err: unknown) => {
              setTokens(prev);
              Alert.alert(
                'Failed to remove device',
                err instanceof ApiError ? err.message : 'Please try again.',
              );
            });
          },
        },
      ],
    );
  };

  const pushEnabled = preferences?.pushEnabled ?? false;
  const permissionDenied = permissionStatus === 'denied';

  return (
    <View style={styles.root}>
      <AppHeader
        title="Notifications"
        user={user ? { name: `${user.firstName} ${user.lastName}` } : undefined}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <RNSectionHeader title="Push Notifications" />
        {permissionDenied ? (
          <RNCard>
            <Text style={styles.banner}>
              Push notifications are disabled in your device settings.
            </Text>
            <Pressable
              style={styles.openBtn}
              onPress={() => void Linking.openSettings()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open device settings"
            >
              <Text style={styles.openBtnLabel}>Open Settings</Text>
              <Icon name="external-link" size="sm" color={palette.metal.rose} />
            </Pressable>
          </RNCard>
        ) : (
          <RNCard padding="sm">
            {isLoadingPrefs ? (
              <SkeletonRow />
            ) : (
              <ToggleRow
                label="Enable Push Notifications"
                sublabel="BDT replies and account updates"
                value={pushEnabled}
                onChange={handleMasterToggle}
              />
            )}
          </RNCard>
        )}

        {pushEnabled && !permissionDenied && (
          <>
            <RNSectionHeader title="Email & Marketing" />
            <RNCard padding="sm">
              <ToggleRow
                label="Email notifications"
                sublabel="Important account and billing emails"
                value={preferences?.emailEnabled ?? true}
                onChange={(v) => void updatePreference({ emailEnabled: v })}
              />
              <Divider />
              <ToggleRow
                label="Marketing updates"
                sublabel="Occasional tips and announcements from BDT"
                value={preferences?.marketing ?? false}
                onChange={(v) => void updatePreference({ marketing: v })}
              />
            </RNCard>
          </>
        )}

        <RNSectionHeader title="My Devices" />
        <RNCard padding={!isLoadingTokens && tokens.length === 0 ? 'md' : 'sm'}>
          {isLoadingTokens ? (
            <>
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
            </>
          ) : tokens.length === 0 ? (
            <RNEmptyState
              icon="smartphone"
              title="No devices registered"
              body="Notifications will register automatically when you sign in on a device"
            />
          ) : (
            tokens.map((tk, idx) => (
              <View key={tk.id}>
                {idx > 0 && <Divider />}
                <DeviceRow token={tk} onRemove={() => handleRemoveDevice(tk)} />
              </View>
            ))
          )}
        </RNCard>

        <View style={{ height: space[12] }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sublabel && <Text style={styles.toggleSub}>{sublabel}</Text>}
      </View>
      <View
        style={[
          styles.toggle,
          { backgroundColor: value ? palette.metal.rose : '#2A2A2A' },
        ]}
      >
        <View
          style={[styles.toggleKnob, { transform: [{ translateX: value ? 18 : 2 }] }]}
        />
      </View>
    </Pressable>
  );
}

function DeviceRow({
  token,
  onRemove,
}: {
  token: DevicePushToken;
  onRemove: () => void;
}) {
  const isIos = /ios/i.test(token.platform);
  return (
    <View style={styles.deviceRow}>
      <View style={styles.deviceIcon}>
        <Icon name="smartphone" size="md" color={palette.metal.rose} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {token.deviceName ?? 'Unknown device'}
        </Text>
        <Text style={styles.deviceMeta}>
          {(isIos ? 'iOS' : 'Android') + ' · ' + formatRelative(token.lastSeenAt)}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${token.deviceName ?? 'device'}`}
      >
        <Icon name="trash-2" color={palette.metal.rose} />
      </Pressable>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={{ flex: 1, gap: space[2] }}>
        <RNSkeleton width={160} height={14} />
        <RNSkeleton width={220} height={11} />
      </View>
      <RNSkeleton width={40} height={22} borderRadius={11} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return 'Active now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[8],
    gap: space[4],
  },

  banner: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  openBtn: {
    marginTop: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
  },
  openBtnLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    textTransform: 'uppercase',
    color: palette.metal.rose,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    gap: space[3],
  },
  toggleLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  toggleSub: {
    marginTop: 2,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(139,115,85,0.4)',
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.ink.primary,
  },

  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    gap: space[3],
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 168, 130, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.3)',
  },
  deviceName: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  deviceMeta: {
    marginTop: 2,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(139,115,85,0.12)',
    marginHorizontal: space[2],
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    gap: space[3],
  },
});
