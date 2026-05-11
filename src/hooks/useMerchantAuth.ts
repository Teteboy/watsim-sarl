import { useState, useCallback } from 'react';

export interface MerchantAuthState {
  isAuthenticated: boolean;
  merchantEmail: string | null;
}

const AUTH_KEY = 'watsim_merchant_auth';

export function getMerchantAuthState(): MerchantAuthState {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as MerchantAuthState;
  } catch {
    // ignore
  }
  return { isAuthenticated: false, merchantEmail: null };
}

export function useMerchantAuth() {
  const [authState, setAuthState] = useState<MerchantAuthState>(getMerchantAuthState);

  const login = useCallback((email: string, _password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock: accept any email ending with @watsim.com or demo credentials
        const valid =
          email.endsWith('@watsim.com') ||
          email === 'demo@merchant.com' ||
          email === 'boutique@example.com';
        if (valid) {
          const state: MerchantAuthState = { isAuthenticated: true, merchantEmail: email };
          sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
          setAuthState(state);
        }
        resolve(valid);
      }, 1200);
    });
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthState({ isAuthenticated: false, merchantEmail: null });
  }, []);

  return { ...authState, login, logout };
}
