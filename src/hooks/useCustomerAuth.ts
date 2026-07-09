import { useState, useCallback } from 'react';
import { authApi, tokenStore } from '@/lib/api';

export interface CustomerAuthState {
  isAuthenticated: boolean;
  customerEmail: string | null;
  fullName: string | null;
}

const AUTH_KEY = 'watsim_customer_auth';

export function getCustomerAuthState(): CustomerAuthState {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as CustomerAuthState;
  } catch {
    // ignore
  }
  const stored = tokenStore.getUser();
  if (stored && stored.role === 'CUSTOMER') {
    return { isAuthenticated: true, customerEmail: stored.email, fullName: stored.fullName ?? null };
  }
  return { isAuthenticated: false, customerEmail: null, fullName: null };
}

export function useCustomerAuth() {
  const [authState, setAuthState] = useState<CustomerAuthState>(getCustomerAuthState);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await authApi.login(email, password);
      if (res.user.role !== 'CUSTOMER') {
        return { ok: false, message: 'Ce compte n\'est pas un compte client.' };
      }
      tokenStore.setTokens(res.accessToken, res.refreshToken);
      tokenStore.setUser(res.user);
      const state: CustomerAuthState = { isAuthenticated: true, customerEmail: res.user.email, fullName: res.user.fullName ?? null };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
      setAuthState(state);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Identifiants invalides' };
    }
  }, []);

  const register = useCallback(async (input: { email: string; phone: string; password: string; fullName: string }): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await authApi.register(input);
      tokenStore.setTokens(res.accessToken, res.refreshToken);
      tokenStore.setUser(res.user);
      const state: CustomerAuthState = { isAuthenticated: true, customerEmail: res.user.email, fullName: res.user.fullName ?? null };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
      setAuthState(state);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Erreur d\'inscription' };
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    sessionStorage.removeItem(AUTH_KEY);
    setAuthState({ isAuthenticated: false, customerEmail: null, fullName: null });
  }, []);

  return { ...authState, login, register, logout };
}
