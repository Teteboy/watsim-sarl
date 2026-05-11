import { useState, useCallback } from 'react';

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
  return { isAuthenticated: false, adminEmail: null };
}

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AdminAuthState>(getAdminAuthState);

  const login = useCallback((email: string, _password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock: accept admin credentials
        const valid =
          email === 'admin@watsim.com' ||
          email === 'superadmin@watsim.com' ||
          email.endsWith('@watsim-admin.com');
        if (valid) {
          const state: AdminAuthState = { isAuthenticated: true, adminEmail: email };
          sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
          setAuthState(state);
        }
        resolve(valid);
      }, 1200);
    });
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthState({ isAuthenticated: false, adminEmail: null });
  }, []);

  return { ...authState, login, logout };
}
