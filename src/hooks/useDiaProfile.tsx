// useDiaProfile - Kullanıcının DIA ERP bağlantı bilgilerini çeker
// Team member'lar team admin'in DIA bilgilerini görür
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DiaProfile {
  sunucuAdi: string | null;
  firmaKodu: string | null;
  firmaAdi: string | null;
  donemKodu: string | null;
  donemYili: string | null;
  isConfigured: boolean;
  // Team member bilgisi
  isTeamMember: boolean;
  teamAdminId: string | null;
  teamAdminEmail: string | null;
}

export function useDiaProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DiaProfile>({
    sunucuAdi: null,
    firmaKodu: null,
    firmaAdi: null,
    donemKodu: null,
    donemYili: null,
    isConfigured: false,
    isTeamMember: false,
    teamAdminId: null,
    teamAdminEmail: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfile({ 
          sunucuAdi: null, firmaKodu: null, firmaAdi: null, donemKodu: null, donemYili: null, 
          isConfigured: false, isTeamMember: false, teamAdminId: null, teamAdminEmail: null 
        });
        setIsLoading(false);
        return;
      }

      try {
        // Önce kullanıcının team member olup olmadığını kontrol et
        const { data: teamData } = await supabase
          .from('user_teams')
          .select('admin_id')
          .eq('member_id', user.id)
          .single();
        
        const isTeamMember = !!teamData?.admin_id;
        const effectiveUserId = teamData?.admin_id || user.id;
        
        // Effective user'ın (team admin veya kendisi) profilini çek
        const { data, error } = await supabase
          .from('profiles')
          .select('dia_sunucu_adi, firma_kodu, firma_adi, donem_kodu, donem_yili, email')
          .eq('user_id', effectiveUserId)
          .single();

        if (error) throw error;

        setProfile({
          sunucuAdi: data?.dia_sunucu_adi || null,
          firmaKodu: data?.firma_kodu || null,
          firmaAdi: data?.firma_adi || null,
          donemKodu: data?.donem_kodu || null,
          donemYili: data?.donem_yili || null,
          isConfigured: !!data?.dia_sunucu_adi,
          isTeamMember,
          teamAdminId: isTeamMember ? effectiveUserId : null,
          teamAdminEmail: isTeamMember ? data?.email : null,
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
