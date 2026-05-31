import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

/**
 * Root route resolver. Only role surfaced inside the app is `client`. The
 * (client) layout itself decides whether to send the user into the
 * (onboarding) flow if they haven't finished plan selection + payment.
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/tenant-select" />;
  if (user.role === 'client') return <Redirect href="/(client)/home" />;
  return <Redirect href="/(auth)/tenant-select" />;
}
