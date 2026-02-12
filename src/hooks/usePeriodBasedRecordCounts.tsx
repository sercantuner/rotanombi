// usePeriodBasedRecordCounts - Her veri kaynağının dönem bazlı kayıt dağılımını çeker
// Veri Senkronizasyonu sayfasında dönem bazlı analiz için kullanılır

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDiaProfile } from '@/hooks/useDiaProfile';

export interface PeriodDistribution {
  [dataSourceSlug: string]: {
    total: number;
    byPeriod: {
      [periodNo: number]: number;
    };
  };
}

export function usePeriodBasedRecordCounts() {
  const diaProfile = useDiaProfile();

  return useQuery({
    queryKey: ['period-based-record-counts', diaProfile.sunucuAdi, diaProfile.firmaKodu],
    queryFn: async () => {
      if (!diaProfile.isConfigured || !diaProfile.sunucuAdi || !diaProfile.firmaKodu) {
        return {};
      }

      try {
        // Tüm dönemlerdeki kayıtları getir (dönem filtresi olmadan)
        const distribution: PeriodDistribution = {};
        let offset = 0;
        const PAGE = 1000;

        while (true) {
          const { data: page, error } = await supabase
            .from('company_data_cache')
            .select('data_source_slug, donem_kodu')
            .eq('sunucu_adi', diaProfile.sunucuAdi!)
            .eq('firma_kodu', diaProfile.firmaKodu!)
            .eq('is_deleted', false)
            .range(offset, offset + PAGE - 1);

          if (error) {
            console.error('[usePeriodBasedRecordCounts] Query error:', error);
            break;
          }

          if (!page || page.length === 0) break;

          // Her kaynağın dönem dağılımını hesapla
          page.forEach((row: { data_source_slug: string; donem_kodu: number }) => {
            const slug = row.data_source_slug;
            const period = row.donem_kodu;

            if (!distribution[slug]) {
              distribution[slug] = { total: 0, byPeriod: {} };
            }

            distribution[slug].total++;
            distribution[slug].byPeriod[period] = (distribution[slug].byPeriod[period] || 0) + 1;
          });

          if (page.length < PAGE) break;
          offset += PAGE;
        }

        return distribution;
      } catch (err) {
        console.error('[usePeriodBasedRecordCounts] Error:', err);
        return {};
      }
    },
    enabled: diaProfile.isConfigured && !!diaProfile.sunucuAdi && !!diaProfile.firmaKodu,
    staleTime: 10 * 1000, // 10 saniye - sync sırasında hızlı güncelleme için
    refetchOnWindowFocus: false,
  });
}
