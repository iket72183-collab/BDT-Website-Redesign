import { cookies } from 'next/headers';
import { USER_COOKIE, type AdminUser } from './auth';

/**
 * Server-side admin user lookup. Reads the user blob the login page wrote
 * into the cookie. Pages call this in their RSC body to populate the header.
 * Returns null if the cookie is missing / malformed (middleware would have
 * already redirected such a request).
 */
export function getCurrentUser(): AdminUser | null {
  const raw = cookies().get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as AdminUser;
  } catch {
    return null;
  }
}
