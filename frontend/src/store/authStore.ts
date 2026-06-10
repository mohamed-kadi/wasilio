import { create } from 'zustand';

const AUTH_STORAGE_KEY = 'nexora.auth.session';
const LEGACY_AUTH_STORAGE_KEY = AUTH_STORAGE_KEY;

export type BlockedTenantStatus = 'OVERDUE' | 'SUSPENDED' | 'DISABLED';

export interface AuthUser {
  email: string;
  role: string;
  tenantId: string;
  expiresAt: number;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

interface JwtPayload {
  sub?: string;
  role?: string;
  tenantId?: string;
  exp?: number;
}

interface AuthState {
  session: AuthSession | null;
  blockedTenantStatus: BlockedTenantStatus | null;
  setToken: (token: string) => void;
  setTenantBlocked: (status: BlockedTenantStatus) => void;
  clearTenantBlocked: () => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: loadSession(),
  blockedTenantStatus: null,
  setToken: (token) => {
    const session = sessionFromToken(token);
    saveSession(session);
    set({ session, blockedTenantStatus: null });
  },
  setTenantBlocked: (status) => {
    set({ blockedTenantStatus: status });
  },
  clearTenantBlocked: () => {
    set({ blockedTenantStatus: null });
  },
  clearSession: () => {
    clearStoredSession();
    set({ session: null, blockedTenantStatus: null });
  },
}));

function loadSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);

  const rawSession = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as AuthSession;
    if (!session.token || !session.user || session.user.expiresAt <= Date.now()) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

function saveSession(session: AuthSession) {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }
}

export function clearStoredSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function sessionFromToken(token: string): AuthSession {
  const payload = decodeJwtPayload(token);
  if (!payload.sub || !payload.role || !payload.tenantId || !payload.exp) {
    throw new Error('Login response token is missing required claims');
  }

  return {
    token,
    user: {
      email: payload.sub,
      role: payload.role.replace(/^ROLE_/, ''),
      tenantId: payload.tenantId,
      expiresAt: payload.exp * 1000,
    },
  };
}

function decodeJwtPayload(token: string): JwtPayload {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Login response token is invalid');
  }

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = normalizedPayload.padEnd(
    normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
    '=',
  );

  return JSON.parse(window.atob(paddedPayload)) as JwtPayload;
}
