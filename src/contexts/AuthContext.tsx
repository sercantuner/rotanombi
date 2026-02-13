import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION covers getSession – no need for a separate call
      if (event === 'INITIAL_SESSION') {
        initialSessionHandled = true;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Fallback: if onAuthStateChange hasn't fired INITIAL_SESSION within 1s, resolve manually
    const fallbackTimer = setTimeout(() => {
      if (!initialSessionHandled) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        });
      }
    }, 1000);

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        let errorMessage = 'Giriş başarısız';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Geçersiz e-posta veya şifre';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'E-posta adresi doğrulanmamış. Lütfen e-postanızı kontrol edin.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Çok fazla deneme. Lütfen bekleyin.';
        }
        return { success: false, error: errorMessage };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Bir hata oluştu' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: displayName },
        },
      });

      if (error) {
        let errorMessage = 'Kayıt başarısız';
        if (error.message.includes('already registered')) {
          errorMessage = 'Bu e-posta adresi zaten kayıtlı';
        } else if (error.message.includes('Password should be')) {
          errorMessage = 'Şifre en az 6 karakter olmalıdır';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Geçersiz e-posta adresi';
        }
        return { success: false, error: errorMessage };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Bir hata oluştu' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        let errorMessage = 'Şifre sıfırlama başarısız';
        if (error.message.includes('Too many requests')) {
          errorMessage = 'Çok fazla deneme. Lütfen bekleyin.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Geçersiz e-posta adresi';
        }
        return { success: false, error: errorMessage };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Bir hata oluştu' };
    }
  }, []);

  const value: AuthContextType = {
    user, session, isLoading,
    isAuthenticated: !!session,
    login, register, logout, resetPassword,
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
