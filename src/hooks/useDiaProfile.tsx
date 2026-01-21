// useDiaProfile - Kullanıcının DIA ERP bağlantı bilgilerini çeker
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DiaProfile {
  sunucuAdi: string | null;
  firmaKodu: string | null;
  firmaAdi: string | null;
  donemKodu: string | null;
  isConfigured: boolean;
}

export function useDiaProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DiaProfile>({
    sunucuAdi: null,
    firmaKodu: null,
    firmaAdi: null,
    donemKodu: null,
    isConfigured: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfile({ sunucuAdi: null, firmaKodu: null, firmaAdi: null, donemKodu: null, isConfigured: false });
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('dia_sunucu_adi, firma_kodu, firma_adi, donem_kodu')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        setProfile({
          sunucuAdi: data?.dia_sunucu_adi || null,
          firmaKodu: data?.firma_kodu || null,
          firmaAdi: data?.firma_adi || null,
          donemKodu: data?.donem_kodu || null,
          isConfigured: !!data?.dia_sunucu_adi,
        });
      } catch (error) {
        console.error('Error fetching DIA profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  return { ...profile, isLoading };
}
