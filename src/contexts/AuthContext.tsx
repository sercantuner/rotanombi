import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SessionData, LoginCredentials } from '@/lib/types';
import { login as apiLogin, logout as apiLogout, getSession, saveSession, getRememberCredentials } from '@/lib/api';

interface AuthContextType {
  session: SessionData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  rememberedCredentials: Omit<LoginCredentials, 'rememberMe'> | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rememberedCredentials, setRememberedCredentials] = useState<Omit<LoginCredentials, 'rememberMe'> | null>(null);

  useEffect(() => {
    // Check for existing session
    const existingSession = getSession();
    if (existingSession) {
      setSession(existingSession);
    }

    // Check for remembered credentials
    const remembered = getRememberCredentials();
    if (remembered) {
      setRememberedCredentials(remembered);
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const result = await apiLogin(credentials);
      if (result.success && result.data) {
        setSession(result.data);
        return { success: true };
      }
      return { success: false, error: result.error || 'Giriş başarısız' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bir hata oluştu' 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setSession(null);
  }, []);

  const value: AuthContextType = {
    session,
    isLoading,
    isAuthenticated: !!session?.isAuthenticated,
    login,
    logout,
    rememberedCredentials,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
