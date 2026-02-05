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

  const effectiveDonem = filter.donemKodu || parseInt(profileDonem || '1');

  return useQuery({
    queryKey: ['companyData', filter.dataSourceSlug, sunucuAdi, firmaKodu, effectiveDonem],
    queryFn: async () => {
      if (!user || !sunucuAdi || !firmaKodu) {
        return [];
      }

      // Sayfalama ile tüm veriyi çek - Supabase varsayılan 1000 limit'i aşmak için
      const PAGE_SIZE = 1000; // Supabase max 1000 satır döndürür
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('company_data_cache')
          .select('data')
          .eq('data_source_slug', filter.dataSourceSlug)
          .eq('donem_kodu', effectiveDonem)
          .range(from, from + PAGE_SIZE - 1);

        if (!filter.includeDeleted) {
          query = query.eq('is_deleted', false);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[useCompanyData] Error fetching data:', error);
          throw error;
        }

        const rows = data || [];
        allData = allData.concat(rows.map(row => row.data));
        
        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      // JSONB data alanlarını düz obje olarak döndür
      return allData;
    },
    enabled: !!user && !!sunucuAdi && !!firmaKodu && !!filter.dataSourceSlug,
    staleTime: 5 * 60 * 1000, // 5 dakika
    gcTime: 30 * 60 * 1000, // 30 dakika
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
