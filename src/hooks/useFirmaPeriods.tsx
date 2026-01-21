// useFirmaPeriods - Firma dönem bilgilerini yönetir
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDiaProfile } from '@/hooks/useDiaProfile';

export interface FirmaPeriod {
  id: string;
  sunucu_adi: string;
  firma_kodu: string;
  period_no: number;
  period_name: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  fetched_at: string | null;
}

interface SyncResult {
  success: boolean;
  periods?: any[];
  activePeriod?: number;
  error?: string;
}

export function useFirmaPeriods() {
  const { user } = useAuth();
  const { sunucuAdi, firmaKodu, isConfigured } = useDiaProfile();
  
  const [periods, setPeriods] = useState<FirmaPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch periods from database
  const fetchPeriods = useCallback(async () => {
    if (!sunucuAdi || !firmaKodu) {
      setPeriods([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('firma_periods')
        .select('*')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .order('period_no', { ascending: false });

      if (fetchError) throw fetchError;

      setPeriods(data || []);
    } catch (err) {
      console.error('Error fetching firma periods:', err);
      setError(err instanceof Error ? err.message : 'Dönemler yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [sunucuAdi, firmaKodu]);

  // Sync periods from DIA
  const syncPeriods = useCallback(async (): Promise<SyncResult> => {
    if (!user) {
      return { success: false, error: 'Kullanıcı oturumu bulunamadı' };
    }

    try {
      setIsSyncing(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { success: false, error: 'Oturum bulunamadı' };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dia-sync-periods`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result: SyncResult = await response.json();

      if (result.success) {
        // Refresh periods from database
        await fetchPeriods();
      } else {
        setError(result.error || 'Senkronizasyon başarısız');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Senkronizasyon hatası';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [user, fetchPeriods]);

  // Get current/active period
  const getCurrentPeriod = useCallback((): FirmaPeriod | null => {
    return periods.find(p => p.is_current) || periods[0] || null;
  }, [periods]);

  // Update selected period in profile
  const selectPeriod = useCallback(async (periodNo: number): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ donem_kodu: periodNo.toString() })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      return true;
    } catch (err) {
      console.error('Error updating period selection:', err);
      return false;
    }
  }, [user]);

  // Initial fetch when profile is configured
  useEffect(() => {
    if (isConfigured) {
      fetchPeriods();
    } else {
      setPeriods([]);
      setIsLoading(false);
    }
  }, [isConfigured, fetchPeriods]);

  return {
    periods,
    isLoading,
    isSyncing,
    error,
    syncPeriods,
    fetchPeriods,
    getCurrentPeriod,
    selectPeriod,
    hasNoPeriods: !isLoading && periods.length === 0,
  };
}