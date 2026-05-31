import { Stack } from 'expo-router';
import { palette } from '@/styles/appTokens';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg.base } }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
