// ImpersonationContext - Süper Admin kullanıcı görüntüleme
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

export interface ImpersonatedProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  license_type: string | null;
  license_expires_at: string | null;
  is_team_admin: boolean | null;
  dia_sunucu_adi: string | null;
  firma_adi: string | null;
  donem_yili: string | null;
}

interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedProfile: ImpersonatedProfile | null;
  isImpersonating: boolean;
  startImpersonation: (userId: string) => void;
  stopImpersonation: () => void;
  canImpersonate: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = usePermissions();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<ImpersonatedProfile | null>(null);

  // Impersonated user'ın profilini yükle
  useEffect(() => {
    if (!impersonatedUserId) {
      setImpersonatedProfile(null);
      return;
    }

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, donem_yili')
        .eq('user_id', impersonatedUserId)
        .single();

      if (!error && data) {
        setImpersonatedProfile(data as ImpersonatedProfile);
      }
    };

    loadProfile();
  }, [impersonatedUserId]);

  const startImpersonation = useCallback((userId: string) => {
    if (!isSuperAdmin) return;
    setImpersonatedUserId(userId);
  }, [isSuperAdmin]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUserId(null);
    setImpersonatedProfile(null);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUserId,
        impersonatedProfile,
        isImpersonating: !!impersonatedUserId,
        startImpersonation,
        stopImpersonation,
        canImpersonate: isSuperAdmin,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
