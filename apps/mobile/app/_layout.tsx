import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import {
  useFonts as useInterFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { palette } from '@/styles/appTokens';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { usePushNotifications } from '@/hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Sentry — initialized at module load (before React renders) so init errors
// in component code are captured. `enabled` gates on the DSN so dev builds
// without a DSN configured don't spam an unused project.
const sentryDsn =
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ?? '';
const sentryEnv =
  (Constants.expoConfig?.extra?.appEnv as string | undefined) ?? 'development';
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: sentryEnv,
  // Don't ship PII (user id / email / IP) unless we explicitly attach it.
  // The privacy policy lists what we collect; Sentry inputs shouldn't widen it.
  sendDefaultPii: false,
  // 10% sample in prod for performance traces; full sample below so dev
  // crashes don't get silently dropped.
  tracesSampleRate: sentryEnv === 'production' ? 0.1 : 1.0,
  debug: false,
});

const queryClient = new QueryClient();

/**
 * Deep-link a notification tap to the right screen. Notification `data`
 * carries `{ type, referenceId }` (set server-side in notify()).
 */
function handleNotificationTap(data: unknown): void {
  const d = (data ?? {}) as { type?: string };
  switch (d.type) {
    case 'message_reply':
      router.push('/(client)/messages' as never);
      break;
    case 'account_update':
    case 'payment_received':
      router.push('/(client)/plan' as never);
      break;
    default:
      break;
  }
}

function RootLayout() {
  const [fontsLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  // Hydrate persisted auth/tenant state from SecureStore before we let the UI
  // render. Otherwise the (auth) vs (owner) routing decision in app/index.tsx
  // flickers from "no user" → "user" on first paint.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void Promise.all([useAuthStore.getState().hydrate(), useTenantStore.getState().hydrate()])
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, hydrated]);

  // --- Push notifications -------------------------------------------------
  const pushUser = useAuthStore((s) => s.user);
  const { registerForPushNotifications, registerTokenWithServer } = usePushNotifications();

  // Register this device once a user is authenticated. Re-runs if the signed-in
  // user changes (logout → login as someone else).
  useEffect(() => {
    if (!pushUser) return;
    registerForPushNotifications()
      .then((token) => (token ? registerTokenWithServer(token) : undefined))
      .catch((err) => console.error('Push registration failed', err));
  }, [pushUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android needs an explicit notification channel before anything shows.
  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages & Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C9A882',
      });
    }
  }, []);

  // Deep-link when the user taps a delivered notification.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);

  const publishableKey =
    (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ?? '';

  if (!fontsLoaded || !hydrated) {
    return <View style={{ flex: 1, backgroundColor: palette.bg.base }} />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StripeProvider publishableKey={publishableKey}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg.base } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(client)" />
            <Stack.Screen name="(onboarding)" />
          </Stack>
        </StripeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// `Sentry.wrap` installs the error boundary + touch-event tracking around
// the root. Required for crash capture of render-tree errors on mobile.
export default Sentry.wrap(RootLayout);
