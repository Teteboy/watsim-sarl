import { useState, useCallback } from 'react';
import { authApi, tokenStore } from '@/lib/api';

export interface AdminAuthState {
  isAuthenticated: boolean;
  adminEmail: string | null;
}

const AUTH_KEY = 'watsim_admin_auth';

export function getAdminAuthState(): AdminAuthState {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as AdminAuthState;
  } catch {
    // ignore
  }
  const stored = tokenStore.getUser();
  if (stored && stored.role === 'ADMIN') {
    return { isAuthenticated: true, adminEmail: stored.email };
  }
  return { isAuthenticated: false, adminEmail: null };
}

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AdminAuthState>(getAdminAuthState);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login(email, password);
      if (res.user.role !== 'ADMIN') return false;
      tokenStore.setTokens(res.accessToken, res.refreshToken);
      tokenStore.setUser(res.user);
      const state: AdminAuthState = { isAuthenticated: true, adminEmail: res.user.email };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
      setAuthState(state);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    sessionStorage.removeItem(AUTH_KEY);
    setAuthState({ isAuthenticated: false, adminEmail: null });
  }, []);

  return { ...authState, login, logout };
}
