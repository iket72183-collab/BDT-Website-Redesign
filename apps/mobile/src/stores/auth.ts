import { create } from 'zustand';
import type { User } from '@bdt/shared-types';
import { storage } from '@/lib/storage';
import { api, ApiError } from '@/api/client';

/**
 * Auth state + API actions. Methods here own the network round-trip so
 * screens stay thin (validate → call store method → router.replace on
 * success). All tokens land in expo-secure-store via the `storage` wrapper.
 */
interface AuthState {
  user: User | null;
  accessToken: string | null;
  // Note: refresh token actually lives in the httpOnly cookie on the API
  // side. Kept here as a nullable shim for API symmetry / web reuse.
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;

  // session lifecycle
  setSession: (s: { user: User; accessToken: string; refreshToken?: string | null }) => Promise<void>;
  /** Lighter-weight than setSession — only swaps the access token. Used by
   *  the API client's refresh-and-retry path so a token rotation doesn't
   *  rewrite the persisted user blob unnecessarily. */
  setAccessToken: (token: string) => Promise<void>;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;

  // API actions
  login: (input: { email: string; password: string; tenantSlug?: string }) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  forgotPassword: (input: { email: string; tenantSlug?: string }) => Promise<void>;
  resetPassword: (input: { token: string; password: string }) => Promise<void>;
  verifyEmail: (input: { token: string }) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<User | null>;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenant: {
    slug: string;
    businessName: string;
  };
}

const KEYS = { access: 'auth.access', refresh: 'auth.refresh', user: 'auth.user' };

interface ApiEnvelope<T> { success: boolean; data: T; error?: string; code?: string }
interface AuthEnvelope { user: User; accessToken: string }

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,

  setSession: async ({ user, accessToken, refreshToken }) => {
    await storage.set(KEYS.access, accessToken);
    if (refreshToken) await storage.set(KEYS.refresh, refreshToken);
    await storage.set(KEYS.user, JSON.stringify(user));
    set({ user, accessToken, refreshToken: refreshToken ?? get().refreshToken });
  },

  setAccessToken: async (token) => {
    await storage.set(KEYS.access, token);
    set({ accessToken: token });
  },

  clear: async () => {
    await Promise.all([storage.delete(KEYS.access), storage.delete(KEYS.refresh), storage.delete(KEYS.user)]);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  hydrate: async () => {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      storage.get(KEYS.access),
      storage.get(KEYS.refresh),
      storage.get(KEYS.user),
    ]);
    set({
      accessToken,
      refreshToken,
      user: userJson ? (JSON.parse(userJson) as User) : null,
    });
  },

  login: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api<ApiEnvelope<AuthEnvelope>>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
        auth: false,
      });
      await get().setSession(res.data);
      return res.data.user;
    } catch (err) {
      set({ error: friendlyAuthError(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api<ApiEnvelope<AuthEnvelope>>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
        auth: false,
      });
      await get().setSession(res.data);
      return res.data.user;
    } catch (err) {
      set({ error: friendlyAuthError(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  forgotPassword: async (input) => {
    // Server always returns success — we don't surface errors here. Anti-enumeration.
    await api('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(input),
      auth: false,
    }).catch(() => undefined);
  },

  resetPassword: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(input),
        auth: false,
      });
    } catch (err) {
      set({ error: friendlyAuthError(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyEmail: async (input) => {
    await api('/api/auth/verify-email', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  resendVerification: async () => {
    await api('/api/auth/verify-email/resend', { method: 'POST' });
  },

  logout: async () => {
    const pushToken = await storage.get('push.current_token');
    if (pushToken) {
      await api('/api/push/deregister', {
        method: 'DELETE',
        body: JSON.stringify({ token: pushToken }),
      }).catch(() => undefined);
      await storage.delete('push.current_token');
    }
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await get().clear();
  },

  /** Re-fetch /me — used by VerifyEmailPending to detect verification completion. */
  refreshMe: async () => {
    try {
      const res = await api<ApiEnvelope<User>>('/api/auth/me');
      const userJson = JSON.stringify(res.data);
      await storage.set(KEYS.user, userJson);
      set({ user: res.data });
      return res.data;
    } catch {
      return null;
    }
  },
}));

/** Map API codes to UI-friendly copy. Keep server codes stable; this is the
 *  single mapping point so screens don't switch on cryptic strings. */
function friendlyAuthError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'Incorrect email or password.';
      case 'user_inactive':
      case 'USER_INACTIVE':
        return 'Your account has been suspended. Contact support.';
      case 'email_unverified':
      case 'EMAIL_UNVERIFIED':
        return 'Please verify your email before signing in.';
      case 'slug_taken':
        return 'That business URL is already taken. Pick another.';
      case 'validation_failed':
        return 'Please check the fields and try again.';
      case 'invalid_token':
      case 'token_expired':
      case 'token_already_used':
        return 'This link has expired or already been used. Request a new one.';
      default:
        return err.message || 'Something went wrong. Try again.';
    }
  }
  return 'Network error. Check your connection and try again.';
}
