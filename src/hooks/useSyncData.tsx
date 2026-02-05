// useSyncData - Veri senkronizasyonu hook'u
// Veritabanından veri çekme ve DIA ile senkronizasyon

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useDataSources } from '@/hooks/useDataSources';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface SyncResult {
  success: boolean;
  recordsFetched?: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  error?: string;
}

export function useSyncData() {
  const queryClient = useQueryClient();
  const diaProfile = useDiaProfile();
  const { dataSources } = useDataSources();
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSyncSource, setCurrentSyncSource] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  // Tek veri kaynağını senkronize et
  const syncDataSource = useCallback(async (dataSourceSlug: string): Promise<SyncResult> => {
    if (!diaProfile.isConfigured) {
      toast.error('DIA bağlantısı yapılandırılmamış');
      return { success: false, error: 'DIA bağlantısı yapılandırılmamış' };
    }

    const dataSource = dataSources.find(ds => ds.slug === dataSourceSlug);
    if (!dataSource) {
      toast.error('Veri kaynağı bulunamadı');
      return { success: false, error: 'Veri kaynağı bulunamadı' };
    }

    setCurrentSyncSource(dataSource.name);
    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-data-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'sync',
          dataSourceSlug,
          forceRefresh: false,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(`Senkronizasyon hatası: ${result.error}`);
        return { success: false, error: result.error };
      }

      toast.success(`${dataSource.name} senkronize edildi (${result.recordsFetched || 0} kayıt)`);
      
      // Cache'i invalidate et
      queryClient.invalidateQueries({ queryKey: ['company-data', dataSourceSlug] });
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });

      return {
        success: true,
        recordsFetched: result.recordsFetched,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      toast.error(`Senkronizasyon hatası: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
      setCurrentSyncSource(null);
      setSyncProgress(100);
    }
  }, [diaProfile, dataSources, queryClient]);

  // Tüm veri kaynaklarını senkronize et
  const syncAllDataSources = useCallback(async (): Promise<void> => {
    if (!diaProfile.isConfigured) {
      toast.error('DIA bağlantısı yapılandırılmamış');
      return;
    }

    const activeDataSources = dataSources.filter(ds => ds.is_active);
    if (activeDataSources.length === 0) {
      toast.info('Senkronize edilecek veri kaynağı yok');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < activeDataSources.length; i++) {
      const ds = activeDataSources[i];
      setCurrentSyncSource(ds.name);
      setSyncProgress(Math.round(((i + 1) / activeDataSources.length) * 100));

      const result = await syncDataSource(ds.slug);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsSyncing(false);
    setCurrentSyncSource(null);

    if (failCount === 0) {
      toast.success(`Tüm veriler senkronize edildi (${successCount} kaynak)`);
    } else {
      toast.warning(`${successCount} başarılı, ${failCount} başarısız`);
    }

    // Cache'leri invalidate et
    queryClient.invalidateQueries({ queryKey: ['company-data'] });
    queryClient.invalidateQueries({ queryKey: ['sync-history'] });
  }, [diaProfile, dataSources, syncDataSource, queryClient]);

  return {
    syncDataSource,
    syncAllDataSources,
    isSyncing,
    currentSyncSource,
    syncProgress,
  };
}

// Sync durumu ve geçmişi için ayrı hook
export function useSyncStatus() {
  const diaProfile = useDiaProfile();

  // Son sync zamanını getir
  const { data: lastSyncTime, isLoading: isLastSyncLoading } = useQuery({
    queryKey: ['last-sync-time', diaProfile.sunucuAdi, diaProfile.firmaKodu],
    queryFn: async () => {
      if (!diaProfile.isConfigured) return null;

      const { data, error } = await supabase
        .from('sync_history')
        .select('completed_at')
        .eq('sunucu_adi', diaProfile.sunucuAdi || '')
        .eq('firma_kodu', diaProfile.firmaKodu || '')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      return data?.completed_at || null;
    },
    enabled: diaProfile.isConfigured,
  });

  // Sync geçmişi
  const { data: syncHistory, isLoading: isSyncHistoryLoading } = useQuery({
    queryKey: ['sync-history', diaProfile.sunucuAdi, diaProfile.firmaKodu],
    queryFn: async () => {
      if (!diaProfile.isConfigured) return [];

      const { data, error } = await supabase
        .from('sync_history')
        .select('*')
        .eq('sunucu_adi', diaProfile.sunucuAdi || '')
        .eq('firma_kodu', diaProfile.firmaKodu || '')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Sync history fetch error:', error);
        return [];
      }
      return data || [];
    },
    enabled: diaProfile.isConfigured,
  });

  return {
    lastSyncTime,
    syncHistory,
    isLoading: isLastSyncLoading || isSyncHistoryLoading,
  };
}
