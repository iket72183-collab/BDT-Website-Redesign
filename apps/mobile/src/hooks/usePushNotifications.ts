import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from '@/api/client';
import { storage } from '@/lib/storage';

/**
 * Expo push registration. Two steps, deliberately separate so the caller can
 * decide when to do each:
 *
 *   registerForPushNotifications() → device check + permission + Expo token
 *   registerTokenWithServer(token) → POST /api/push/register
 *
 * Push only works on a physical device — the iOS Simulator / Android emulator
 * cannot receive remote notifications, so we bail early there.
 */
export function usePushNotifications() {
  const registerForPushNotifications = async (): Promise<string | null> => {
    // 1. Physical device only — simulators can't receive push.
    if (!Device.isDevice) {
      console.warn('Push notifications are unavailable on a simulator/emulator');
      return null;
    }

    // 2. Permissions — only ask if not already decided.
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      // User declined — don't pester them; they can enable it later in Settings.
      return null;
    }

    // 3. Expo push token (needs the EAS projectId from app.json -> extra.eas).
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data;
  };

  const registerTokenWithServer = async (token: string): Promise<void> => {
    await api('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? undefined,
      }),
    });
    await storage.set('push.current_token', token);
  };

  const deregisterTokenWithServer = async (token: string): Promise<void> => {
    await api('/api/push/deregister', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
    await storage.delete('push.current_token');
  };

  return {
    registerForPushNotifications,
    registerTokenWithServer,
    deregisterTokenWithServer,
  };
}
