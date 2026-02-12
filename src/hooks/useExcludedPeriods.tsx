// useExcludedPeriods - Hariç tutulan dönemleri yönetir
// excluded_periods tablosundan okuma, ekleme ve silme işlemleri

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ExcludedPeriod {
  id: string;
  sunucu_adi: string;
  firma_kodu: string;
  donem_kodu: number;
  data_source_slug: string | null;
  excluded_by: string;
  created_at: string;
}

export function useExcludedPeriods() {
  const queryClient = useQueryClient();
  const diaProfile = useDiaProfile();
  const { user } = useAuth();

  const queryKey = ['excluded-periods', diaProfile.sunucuAdi, diaProfile.firmaKodu];

  const { data: excludedPeriods = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!diaProfile.sunucuAdi || !diaProfile.firmaKodu) return [];

      const { data, error } = await supabase
        .from('excluded_periods')
        .select('*')
        .eq('sunucu_adi', diaProfile.sunucuAdi)
        .eq('firma_kodu', diaProfile.firmaKodu);

      if (error) {
        console.error('[useExcludedPeriods] Fetch error:', error);
        return [];
      }
      return (data || []) as ExcludedPeriod[];
    },
    enabled: diaProfile.isConfigured && !!diaProfile.sunucuAdi && !!diaProfile.firmaKodu,
  });

  // Bir dönem belirli kaynak için hariç tutulmuş mu?
  const isExcluded = (donemKodu: number, dataSourceSlug?: string): boolean => {
    return excludedPeriods.some(ep =>
      ep.donem_kodu === donemKodu &&
      (ep.data_source_slug === null || ep.data_source_slug === (dataSourceSlug || null))
    );
  };

  // Dönem hariç tut + verileri sil
  const excludePeriod = useMutation({
    mutationFn: async ({ donemKodu, dataSourceSlug }: { donemKodu: number; dataSourceSlug?: string }) => {
      if (!diaProfile.sunucuAdi || !diaProfile.firmaKodu || !user?.id) {
        throw new Error('Profil bilgileri eksik');
      }

      // 1. excluded_periods tablosuna ekle
      const { error: insertError } = await supabase
        .from('excluded_periods')
        .upsert({
          sunucu_adi: diaProfile.sunucuAdi,
          firma_kodu: diaProfile.firmaKodu,
          donem_kodu: donemKodu,
          data_source_slug: dataSourceSlug || null,
          excluded_by: user.id,
        }, {
          onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,excluded_by',
        });

      if (insertError) throw insertError;

      // 2. O dönemin verilerini company_data_cache'ten sil
      let deleteQuery = supabase
        .from('company_data_cache')
        .delete()
        .eq('sunucu_adi', diaProfile.sunucuAdi)
        .eq('firma_kodu', diaProfile.firmaKodu)
        .eq('donem_kodu', donemKodu);

      if (dataSourceSlug) {
        deleteQuery = deleteQuery.eq('data_source_slug', dataSourceSlug);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        console.error('[useExcludedPeriods] Cache delete error:', deleteError);
      }

      // 3. period_sync_status kayıtlarını sil
      let syncStatusQuery = supabase
        .from('period_sync_status')
        .delete()
        .eq('sunucu_adi', diaProfile.sunucuAdi)
        .eq('firma_kodu', diaProfile.firmaKodu)
        .eq('donem_kodu', donemKodu);

      if (dataSourceSlug) {
        syncStatusQuery = syncStatusQuery.eq('data_source_slug', dataSourceSlug);
      }

      const { error: syncStatusError } = await syncStatusQuery;
      if (syncStatusError) {
        console.error('[useExcludedPeriods] Sync status delete error:', syncStatusError);
      }

      // 4. sync_history kayıtlarını sil
      let syncHistoryQuery = supabase
        .from('sync_history')
        .delete()
        .eq('sunucu_adi', diaProfile.sunucuAdi)
        .eq('firma_kodu', diaProfile.firmaKodu)
        .eq('donem_kodu', donemKodu);

      if (dataSourceSlug) {
        syncHistoryQuery = syncHistoryQuery.eq('data_source_slug', dataSourceSlug);
      }

      const { error: syncHistoryError } = await syncHistoryQuery;
      if (syncHistoryError) {
        console.error('[useExcludedPeriods] Sync history delete error:', syncHistoryError);
      }

      return { donemKodu, dataSourceSlug };
    },
    onSuccess: ({ donemKodu, dataSourceSlug }) => {
      toast.success(`Dönem ${donemKodu}${dataSourceSlug ? ` (${dataSourceSlug})` : ''} hariç tutuldu ve verileri silindi`);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['cache-record-counts'] });
      queryClient.invalidateQueries({ queryKey: ['period-based-record-counts'] });
      queryClient.invalidateQueries({ queryKey: ['company-data'] });
    },
    onError: (error) => {
      toast.error(`Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    },
  });

  // Dönem hariç tutmayı kaldır (tekrar çekilebilir hale getir)
  const includePeriod = useMutation({
    mutationFn: async ({ donemKodu, dataSourceSlug }: { donemKodu: number; dataSourceSlug?: string }) => {
      if (!diaProfile.sunucuAdi || !diaProfile.firmaKodu) {
        throw new Error('Profil bilgileri eksik');
      }

      let query = supabase
        .from('excluded_periods')
        .delete()
        .eq('sunucu_adi', diaProfile.sunucuAdi)
        .eq('firma_kodu', diaProfile.firmaKodu)
        .eq('donem_kodu', donemKodu);

      if (dataSourceSlug) {
        query = query.eq('data_source_slug', dataSourceSlug);
      } else {
        query = query.is('data_source_slug', null);
      }

      const { error } = await query;
      if (error) throw error;

      return { donemKodu, dataSourceSlug };
    },
    onSuccess: ({ donemKodu }) => {
      toast.success(`Dönem ${donemKodu} tekrar senkronize edilebilir`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(`Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    },
  });

  // Belirli bir kaynak için hariç tutulan dönem listesi
  const getExcludedPeriodsForSource = (dataSourceSlug: string): number[] => {
    return excludedPeriods
      .filter(ep => ep.data_source_slug === null || ep.data_source_slug === dataSourceSlug)
      .map(ep => ep.donem_kodu);
  };

  // Tüm hariç tutulan dönem numaraları (global)
  const getAllExcludedPeriods = (): number[] => {
    return [...new Set(excludedPeriods.map(ep => ep.donem_kodu))];
  };

  return {
    excludedPeriods,
    isLoading,
    isExcluded,
    excludePeriod,
    includePeriod,
    getExcludedPeriodsForSource,
    getAllExcludedPeriods,
  };
}
