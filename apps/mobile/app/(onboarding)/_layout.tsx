import { Stack } from 'expo-router';
import { palette } from '@/styles/appTokens';

/**
 * Linear flow: plan-selection → payment-setup → /(client)/home. No tab bar,
 * no back-to-tabs gesture (gestureEnabled: false on individual screens).
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg.base },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="plan-selection" />
      <Stack.Screen name="payment-setup" />
    </Stack>
  );
}
