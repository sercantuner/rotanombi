// ImpersonationContext - Süper Admin kullanıcı görüntüleme
// DIA bağlantı bilgileri dahil - impersonated user'ın gerçek verilerini çekmek için
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<ImpersonatedProfile | null>(null);
  const [isDiaConfigured, setIsDiaConfigured] = useState<boolean>(false);

  // Impersonated user'ın profilini yükle
  // GÜVENLİK: Team admin'ler sadece temel profil bilgilerini görebilir
  // DIA şifreleri, API key'leri gibi hassas veriler sadece super admin'ler için yüklenir
  useEffect(() => {
    if (!impersonatedUserId) {
      setImpersonatedProfile(null);
      return;
    }

    const loadProfile = async () => {
      console.log('[Impersonation] Loading profile for user:', impersonatedUserId);
      
      // Temel profil bilgilerini yükle
      const { data: basicData, error: basicError } = await supabase
        .from('profiles')
        .select(`
          user_id, email, display_name, avatar_url, 
          license_type, license_expires_at, is_team_admin,
          firma_adi, donem_yili
        `)
        .eq('user_id', impersonatedUserId)
        .single();

      if (!basicError && basicData) {
        console.log('[Impersonation] Profile loaded (safe view):', {
          email: basicData.email,
          firma_adi: basicData.firma_adi
        });
        
        // Super Admin ise, DIA bağlantı durumunu kontrol et
        // Hassas bilgileri frontend'e çekmeden, sadece varlığını kontrol edelim
        if (isSuperAdmin) {
          // Edge function ile DIA yapılandırma durumunu kontrol et
          try {
            const { data: checkData, error: checkError } = await supabase.functions.invoke('dia-api-test', {
              body: {
                targetUserId: impersonatedUserId,
                checkConnectionOnly: true
              }
            });
            
            if (!checkError && checkData?.diaConfigured) {
              console.log('[Impersonation] DIA is configured for user');
              setIsDiaConfigured(true);
              
              // Profile'a DIA bağlantı meta bilgilerini ekle (hassas olmayan)
              setImpersonatedProfile({
                ...basicData,
                dia_sunucu_adi: checkData.sunucuAdi || null,
                dia_ws_kullanici: null, // Hassas - gizle
                dia_ws_sifre: null, // Hassas - gizle
                dia_api_key: null, // Hassas - gizle
                dia_session_id: checkData.hasSession ? 'active' : null,
                dia_session_expires: null,
                firma_kodu: checkData.firmaKodu || null,
                firma_adi: basicData.firma_adi,
                donem_kodu: checkData.donemKodu || null,
                donem_yili: basicData.donem_yili
              } as ImpersonatedProfile);
            } else {
              console.log('[Impersonation] DIA not configured for user');
              setIsDiaConfigured(false);
              setImpersonatedProfile({
                ...basicData,
                dia_sunucu_adi: null,
                dia_ws_kullanici: null,
                dia_ws_sifre: null,
                dia_api_key: null,
                dia_session_id: null,
                dia_session_expires: null,
                firma_kodu: null,
                donem_kodu: null
              } as ImpersonatedProfile);
            }
          } catch (err) {
            console.error('[Impersonation] Failed to check DIA config:', err);
            setIsDiaConfigured(false);
            setImpersonatedProfile({
              ...basicData,
              dia_sunucu_adi: null,
              dia_ws_kullanici: null,
              dia_ws_sifre: null,
              dia_api_key: null,
              dia_session_id: null,
              dia_session_expires: null,
              firma_kodu: null,
              donem_kodu: null
            } as ImpersonatedProfile);
          }
        } else {
          // Super admin değilse sadece temel bilgileri göster
          setIsDiaConfigured(false);
          setImpersonatedProfile({
            ...basicData,
            dia_sunucu_adi: null,
            dia_ws_kullanici: null,
            dia_ws_sifre: null,
            dia_api_key: null,
            dia_session_id: null,
            dia_session_expires: null,
            firma_kodu: null,
            donem_kodu: null
          } as ImpersonatedProfile);
        }
      } else {
        console.error('[Impersonation] Failed to load profile:', basicError);
        setIsDiaConfigured(false);
      }
    };

    loadProfile();
  }, [impersonatedUserId, isSuperAdmin]);

  const startImpersonation = useCallback((userId: string) => {
    if (!isSuperAdmin) return;
    console.log('[Impersonation] Starting impersonation for:', userId);
    setImpersonatedUserId(userId);
  }, [isSuperAdmin]);

  const stopImpersonation = useCallback(() => {
    console.log('[Impersonation] Stopping impersonation');
    setImpersonatedUserId(null);
    setImpersonatedProfile(null);
    setIsDiaConfigured(false);
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
