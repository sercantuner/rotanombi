// ImpersonationContext - Süper Admin kullanıcı görüntüleme
// DIA bağlantı bilgileri dahil - impersonated user'ın gerçek verilerini çekmek için
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
  // DIA bağlantı bilgileri
  dia_sunucu_adi: string | null;
  dia_ws_kullanici: string | null;
  dia_ws_sifre: string | null;
  dia_api_key: string | null;
  dia_session_id: string | null;
  dia_session_expires: string | null;
  firma_kodu: string | null;
  firma_adi: string | null;
  donem_kodu: string | null;
  donem_yili: string | null;
}

interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedProfile: ImpersonatedProfile | null;
  isImpersonating: boolean;
  startImpersonation: (userId: string) => void;
  stopImpersonation: () => void;
  canImpersonate: boolean;
  // DIA bağlantı durumu
  isDiaConfigured: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = usePermissions();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<ImpersonatedProfile | null>(null);

  // Impersonated user'ın profilini yükle (DIA bilgileri dahil)
  useEffect(() => {
    if (!impersonatedUserId) {
      setImpersonatedProfile(null);
      return;
    }

    const loadProfile = async () => {
      console.log('[Impersonation] Loading profile for user:', impersonatedUserId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id, email, display_name, avatar_url, 
          license_type, license_expires_at, is_team_admin,
          dia_sunucu_adi, dia_ws_kullanici, dia_ws_sifre, dia_api_key,
          dia_session_id, dia_session_expires,
          firma_kodu, firma_adi, donem_kodu, donem_yili
        `)
        .eq('user_id', impersonatedUserId)
        .single();

      if (!error && data) {
        console.log('[Impersonation] Profile loaded:', {
          email: data.email,
          dia_sunucu_adi: data.dia_sunucu_adi,
          firma_kodu: data.firma_kodu,
          hasDiaConfig: !!data.dia_sunucu_adi
        });
        setImpersonatedProfile(data as ImpersonatedProfile);
      } else {
        console.error('[Impersonation] Failed to load profile:', error);
      }
    };

    loadProfile();
  }, [impersonatedUserId]);

  const startImpersonation = useCallback((userId: string) => {
    if (!isSuperAdmin) return;
    console.log('[Impersonation] Starting impersonation for:', userId);
    setImpersonatedUserId(userId);
  }, [isSuperAdmin]);

  const stopImpersonation = useCallback(() => {
    console.log('[Impersonation] Stopping impersonation');
    setImpersonatedUserId(null);
    setImpersonatedProfile(null);
  }, []);

  // DIA bağlantısı yapılandırılmış mı?
  const isDiaConfigured = !!(impersonatedProfile?.dia_sunucu_adi && impersonatedProfile?.firma_kodu);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUserId,
        impersonatedProfile,
        isImpersonating: !!impersonatedUserId,
        startImpersonation,
        stopImpersonation,
        canImpersonate: isSuperAdmin,
        isDiaConfigured,
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
