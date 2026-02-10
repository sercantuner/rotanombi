// useCompanyData - Veritabanından şirket verilerini okuma hook'u
// RLS sayesinde otomatik olarak sadece kullanıcının şirket verileri gelir

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { toast } from 'sonner';

interface CompanyDataFilter {
  dataSourceSlug: string;
  donemKodu?: number;
  includeDeleted?: boolean;
  isPeriodIndependent?: boolean;
  requiredFields?: string[];
}

interface SyncOptions {
  dataSourceSlug?: string;
  forceRefresh?: boolean;
}

interface SyncResult {
  success: boolean;
  dataSourceSlug?: string;
  recordsFetched?: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsDeleted?: number;
  error?: string;
}

interface SyncStatus {
  syncHistory: any[];
  periodStatus: any[];
  recordCounts: Record<string, number>;
  currentPeriod: number;
}

// Veritabanından veri okuma
export function useCompanyData(filter: CompanyDataFilter) {
  const { user } = useAuth();
  const { sunucuAdi, firmaKodu, donemKodu: profileDonem } = useDiaProfile();

  const profileDonemNum = parseInt(profileDonem || '1');
  const effectiveDonem = filter.donemKodu || profileDonemNum;

  return useQuery({
    queryKey: ['companyData', filter.dataSourceSlug, sunucuAdi, firmaKodu, effectiveDonem],
    queryFn: async () => {
      if (!user || !sunucuAdi || !firmaKodu) {
        return [];
      }

      const PAGE_SIZE = 1000;
      const useProjection = filter.requiredFields && filter.requiredFields.length > 0;

      // Helper: Tek dönem için sayfalayarak veri çeker
      const fetchPeriod = async (donem: number): Promise<any[]> => {
        let periodData: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          let rows: any[] = [];
          let fetchError: any = null;

          if (useProjection) {
            const { data, error } = await supabase.rpc('get_projected_cache_data', {
              p_data_source_slug: filter.dataSourceSlug,
              p_sunucu_adi: sunucuAdi!,
              p_firma_kodu: firmaKodu!,
              p_donem_kodu: donem,
              p_fields: filter.requiredFields!,
              p_limit: PAGE_SIZE,
              p_offset: from,
            });
            fetchError = error;
            rows = (data as any[]) || [];
          } else {
            let query = supabase
              .from('company_data_cache')
              .select('data')
              .eq('data_source_slug', filter.dataSourceSlug)
              .eq('donem_kodu', donem)
              .range(from, from + PAGE_SIZE - 1);

            if (!filter.includeDeleted) {
              query = query.eq('is_deleted', false) as typeof query;
            }

            const { data, error } = await query;
            fetchError = error;
            rows = data || [];
          }

          if (fetchError) {
            console.error('[useCompanyData] Error fetching data:', fetchError);
            throw fetchError;
          }

          periodData = periodData.concat(rows.map(row => row.data));
          hasMore = rows.length >= PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return periodData;
      };

      if (filter.isPeriodIndependent) {
        // PERIOD-BATCHED: Mevcut dönemleri tespit et, her biri için ayrı sorgu at
        const { data: periodsData, error: periodsError } = await supabase
          .from('company_data_cache')
          .select('donem_kodu')
          .eq('data_source_slug', filter.dataSourceSlug)
          .eq('sunucu_adi', sunucuAdi!)
          .eq('firma_kodu', firmaKodu!)
          .eq('is_deleted', false);

        if (periodsError) {
          console.error('[useCompanyData] Period discovery error:', periodsError);
          throw periodsError;
        }

        const distinctPeriods = [...new Set((periodsData || []).map(r => r.donem_kodu))].sort((a, b) => a - b);

        if (distinctPeriods.length === 0) return [];

        console.log(`[useCompanyData] PERIOD-BATCH: ${filter.dataSourceSlug} - ${distinctPeriods.length} periods`);

        let allData: any[] = [];
        for (const period of distinctPeriods) {
          const periodData = await fetchPeriod(period);
          allData = allData.concat(periodData);
        }
        return allData;
      } else {
        // Normal tek-dönem sorgusu
        return await fetchPeriod(effectiveDonem);
      }
    },
    enabled: !!user && !!sunucuAdi && !!firmaKodu && !!filter.dataSourceSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Senkronizasyon durumunu getir
export function useSyncStatus() {
  const { user } = useAuth();
  const { sunucuAdi, firmaKodu, isConfigured } = useDiaProfile();

  return useQuery({
    queryKey: ['syncStatus', sunucuAdi, firmaKodu],
    queryFn: async (): Promise<SyncStatus> => {
      if (!user || !isConfigured) {
        return { syncHistory: [], periodStatus: [], recordCounts: {}, currentPeriod: 1 };
      }

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      const response = await supabase.functions.invoke('dia-data-sync', {
        body: { action: 'getSyncStatus' },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    enabled: !!user && isConfigured,
    staleTime: 30 * 1000, // 30 saniye
  });
}

// Senkronizasyon tetikleme
export function useSyncData() {
  const queryClient = useQueryClient();
  const { sunucuAdi, firmaKodu } = useDiaProfile();

  return useMutation({
    mutationFn: async (options: SyncOptions): Promise<{ success: boolean; results: SyncResult[] }> => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      const response = await supabase.functions.invoke('dia-data-sync', {
        body: {
          action: options.dataSourceSlug ? 'sync' : 'syncAll',
          dataSourceSlug: options.dataSourceSlug,
          forceRefresh: options.forceRefresh,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Cache'leri invalidate et
      queryClient.invalidateQueries({ queryKey: ['companyData'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });

      const successCount = data.results.filter(r => r.success).length;
      const failCount = data.results.filter(r => !r.success).length;

      if (failCount === 0) {
        toast.success(`${successCount} veri kaynağı senkronize edildi`);
      } else if (successCount > 0) {
        toast.warning(`${successCount} başarılı, ${failCount} başarısız`);
      } else {
        toast.error('Senkronizasyon başarısız');
      }
    },
    onError: (error) => {
      console.error('[useSyncData] Sync error:', error);
      toast.error(`Senkronizasyon hatası: ${error.message}`);
    },
  });
}

// Son senkronizasyon zamanını hesapla
export function useLastSyncTime() {
  const { data: syncStatus } = useSyncStatus();

  if (!syncStatus?.syncHistory?.length) {
    return null;
  }

  const lastSync = syncStatus.syncHistory
    .filter((h: any) => h.status === 'completed')
    .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];

  return lastSync?.completed_at ? new Date(lastSync.completed_at) : null;
}

// Belirli veri kaynağı için kayıt sayısı
export function useDataSourceRecordCount(dataSourceSlug: string) {
  const { data: syncStatus } = useSyncStatus();
  return syncStatus?.recordCounts?.[dataSourceSlug] || 0;
}
