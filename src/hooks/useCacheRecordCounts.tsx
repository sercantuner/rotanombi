// useCacheRecordCounts - Cache'deki gerçek kayıt sayılarını çeker
// Veri Yönetimi sayfasında doğru sayıları göstermek için kullanılır

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDiaProfile } from '@/hooks/useDiaProfile';

export function useCacheRecordCounts() {
  const diaProfile = useDiaProfile();

  return useQuery({
    queryKey: ['cache-record-counts', diaProfile.sunucuAdi, diaProfile.firmaKodu, diaProfile.donemKodu],
    queryFn: async () => {
      if (!diaProfile.isConfigured || !diaProfile.sunucuAdi || !diaProfile.firmaKodu) {
        return {};
      }

      // RPC fonksiyonu ile hızlı sayım - dönem kodu ile
      const donemKodu = diaProfile.donemKodu ? parseInt(diaProfile.donemKodu, 10) : null;
      
      const { data, error } = await supabase.rpc('get_cache_record_counts', {
        p_sunucu_adi: diaProfile.sunucuAdi,
        p_firma_kodu: diaProfile.firmaKodu,
        p_donem_kodu: donemKodu,
      });

      if (error) {
        console.error('[useCacheRecordCounts] RPC error:', error);
        // Fallback: Doğrudan sorgu (dönem filtreli)
        let query = supabase
          .from('company_data_cache')
          .select('data_source_slug')
          .eq('sunucu_adi', diaProfile.sunucuAdi)
          .eq('firma_kodu', diaProfile.firmaKodu)
          .eq('is_deleted', false);
        
        if (donemKodu) {
          query = query.eq('donem_kodu', donemKodu);
        }
        
        const { data: fallbackData } = await query;

        if (fallbackData) {
          const counts: Record<string, number> = {};
          fallbackData.forEach(row => {
            counts[row.data_source_slug] = (counts[row.data_source_slug] || 0) + 1;
          });
          return counts;
        }
        return {};
      }

      // RPC sonucunu objeye dönüştür
      const counts: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((row: { data_source_slug: string; record_count: number }) => {
          counts[row.data_source_slug] = Number(row.record_count);
        });
      }
      return counts;
    },
    enabled: diaProfile.isConfigured && !!diaProfile.sunucuAdi && !!diaProfile.firmaKodu,
    staleTime: 30 * 1000, // 30 saniye cache
    refetchOnWindowFocus: false,
  });
}
