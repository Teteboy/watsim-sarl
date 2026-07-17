import { useState, useCallback } from 'react';
import { authApi, tokenStore } from '@/lib/api';

export interface MerchantAuthState {
  isAuthenticated: boolean;
  merchantEmail: string | null;
}

const AUTH_KEY = 'watsim_merchant_auth';

export function getMerchantAuthState(): MerchantAuthState {
  const stored = tokenStore.getUser();
  if (stored && stored.role === 'MERCHANT') {
    return { isAuthenticated: true, merchantEmail: stored.email };
  }
  // Clean up any stale merchant-only session flag when the current user is not a merchant
  try { sessionStorage.removeItem(AUTH_KEY); } catch { /* ignore storage error */ }
  return { isAuthenticated: false, merchantEmail: null };
}

export function useMerchantAuth() {
  const [authState, setAuthState] = useState<MerchantAuthState>(getMerchantAuthState);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login(email, password);
      if (res.user.role !== 'MERCHANT') return false;
      tokenStore.setTokens(res.accessToken, res.refreshToken);
      tokenStore.setUser(res.user);
      const state: MerchantAuthState = { isAuthenticated: true, merchantEmail: res.user.email };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
      setAuthState(state);
      return true;
    } catch {
      return false;
    }
  }, []);

  const register = useCallback(async (input: {
    email?: string; phone: string; password: string; fullName: string;
    businessName: string; category: string; city: string;
  }): Promise<{ ok: boolean; message?: string; email?: string }> => {
    try {
      const res = await authApi.registerMerchant(input);
      tokenStore.setTokens(res.accessToken, res.refreshToken);
      tokenStore.setUser(res.user);
      const state: MerchantAuthState = { isAuthenticated: true, merchantEmail: res.user.email };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
      setAuthState(state);
      return { ok: true, email: res.user.email };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      return { ok: false, message: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    sessionStorage.removeItem(AUTH_KEY);
    setAuthState({ isAuthenticated: false, merchantEmail: null });
  }, []);

  return { ...authState, login, register, logout };
}
