import type { createClient } from 'src/services/supabase/client';

export const ACTIVE_USER_NAME_STORAGE_KEY = 'school_active_user_name';
export const ACTIVE_USER_EMAIL_STORAGE_KEY = 'school_active_user_email';

export interface ResolvedActiveUser {
  id: string | null;
  authId: string | null;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

export function deriveDisplayNameFromEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  if (clean === 'stephanie.womble@gmail.com' || clean.startsWith('stephanie')) {
    return 'Stephanie Womble';
  }
  if (clean === 'blake.womble@gmail.com' || clean.startsWith('blake')) {
    return 'Blake Womble';
  }
  const localPart = email.split('@')[0] || 'Parent User';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getCachedActiveUserName(): string {
  if (typeof window === 'undefined') {
    return 'Parent User';
  }
  const storedName = localStorage.getItem(ACTIVE_USER_NAME_STORAGE_KEY);
  if (storedName && storedName.trim().length > 0 && !storedName.includes('@')) {
    return storedName.trim();
  }
  const storedEmail = localStorage.getItem(ACTIVE_USER_EMAIL_STORAGE_KEY);
  if (storedEmail && storedEmail.trim().length > 0) {
    const derived = deriveDisplayNameFromEmail(storedEmail);
    localStorage.setItem(ACTIVE_USER_NAME_STORAGE_KEY, derived);
    return derived;
  }
  return 'Parent User';
}

export function setCachedActiveUser(params: {
  fullName?: string | null;
  email?: string | null;
}): void {
  if (typeof window === 'undefined') return;

  const cleanEmail = params.email?.trim() || '';
  if (cleanEmail) {
    localStorage.setItem(ACTIVE_USER_EMAIL_STORAGE_KEY, cleanEmail);
  }

  const rawName = params.fullName?.trim() || '';
  const resolvedName =
    rawName && !rawName.includes('@')
      ? rawName
      : cleanEmail
      ? deriveDisplayNameFromEmail(cleanEmail)
      : '';

  if (resolvedName) {
    localStorage.setItem(ACTIVE_USER_NAME_STORAGE_KEY, resolvedName);
  }
}

export function clearCachedActiveUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_USER_NAME_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_USER_EMAIL_STORAGE_KEY);
}

const LAST_ACTIVITY_PING_STORAGE_KEY = 'school_active_user_last_ping_ms';
const ACTIVITY_PING_THROTTLE_MS = 60 * 1000; // 1 minute

function shouldRecordActivityPing(userId: string, existingTimestamp: string | null): boolean {
  if (!existingTimestamp) return true;
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${LAST_ACTIVITY_PING_STORAGE_KEY}:${userId}`);
    const lastPingMs = raw ? Number(raw) : 0;
    const nowMs = Date.now();
    if (!lastPingMs || nowMs - lastPingMs >= ACTIVITY_PING_THROTTLE_MS) {
      localStorage.setItem(`${LAST_ACTIVITY_PING_STORAGE_KEY}:${userId}`, String(nowMs));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function resolveAndSyncActiveUser(
  supabase: ReturnType<typeof createClient>
): Promise<ResolvedActiveUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeEmail =
    user?.email ||
    (typeof window !== 'undefined'
      ? localStorage.getItem(ACTIVE_USER_EMAIL_STORAGE_KEY)
      : null);

  if (!activeEmail && !user?.id) {
    return null;
  }

  const nowIso = new Date().toISOString();

  if (user?.id) {
    const { data: byAuthId } = await supabase
      .from('users')
      .select('id, auth_id, full_name, email, role, avatar_url, last_login_at')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (byAuthId) {
      if (shouldRecordActivityPing(byAuthId.id, byAuthId.last_login_at)) {
        await supabase
          .from('users')
          .update({ last_login_at: nowIso, updated_at: nowIso })
          .eq('id', byAuthId.id);
      }
      const displayName =
        byAuthId.full_name && !byAuthId.full_name.includes('@')
          ? byAuthId.full_name
          : deriveDisplayNameFromEmail(byAuthId.email);
      setCachedActiveUser({ fullName: displayName, email: byAuthId.email });
      return {
        id: byAuthId.id,
        authId: byAuthId.auth_id,
        fullName: displayName,
        email: byAuthId.email,
        role: byAuthId.role,
        avatarUrl: byAuthId.avatar_url,
      };
    }
  }

  if (activeEmail) {
    const { data: byEmail } = await supabase
      .from('users')
      .select('id, auth_id, full_name, email, role, avatar_url, last_login_at')
      .ilike('email', activeEmail)
      .maybeSingle();

    if (byEmail) {
      const needsAuthLink = Boolean(user?.id && !byEmail.auth_id);
      const needsActivityPing = shouldRecordActivityPing(byEmail.id, byEmail.last_login_at);
      if (needsAuthLink || needsActivityPing) {
        await supabase
          .from('users')
          .update({
            ...(needsAuthLink && user?.id ? { auth_id: user.id } : {}),
            last_login_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', byEmail.id);
      }
      const displayName =
        byEmail.full_name && !byEmail.full_name.includes('@')
          ? byEmail.full_name
          : deriveDisplayNameFromEmail(byEmail.email);
      setCachedActiveUser({ fullName: displayName, email: byEmail.email });
      return {
        id: byEmail.id,
        authId: user?.id || byEmail.auth_id,
        fullName: displayName,
        email: byEmail.email,
        role: byEmail.role,
        avatarUrl: byEmail.avatar_url,
      };
    }

    const fallbackName =
      (typeof user?.user_metadata?.full_name === 'string' &&
        user.user_metadata.full_name) ||
      deriveDisplayNameFromEmail(activeEmail);
    setCachedActiveUser({ fullName: fallbackName, email: activeEmail });
    return {
      id: null,
      authId: user?.id || null,
      fullName: fallbackName,
      email: activeEmail,
      role: 'parent',
      avatarUrl: null,
    };
  }

  return null;
}
