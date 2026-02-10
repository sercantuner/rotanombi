// useSyncOrchestrator - Frontend orkestrasyon hook'u
// Chunk bazlı full sync ve incremental sync yönetimi

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useDataSources } from '@/hooks/useDataSources';
import { useFirmaPeriods } from '@/hooks/useFirmaPeriods';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CHUNK_SIZE = 300;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff

// KURAL: Tüm kaynaklar küçük pageSize ile çekilir (CancelledError/timeout önlenir)
const DEFAULT_PAGE_SIZE = 50;
// Lisanssız/yetkisiz modüller - hata alınca skip edilecek
const SKIP_ERROR_PATTERNS = ['Session refresh fail', 'dönem yetki', 'INVALID_SESSION', '404'];

export interface SyncTask {
  slug: string;
  name: string;
  periodNo: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  type: 'full' | 'incremental';
  fetched: number;
  written: number;
  error?: string;
}

export interface SyncProgress {
  isRunning: boolean;
  currentSource: string | null;
  currentPeriod: number | null;
  currentType: 'full' | 'incremental' | null;
  tasks: SyncTask[];
  overallPercent: number;
  totalFetched: number;
  totalWritten: number;
}

export function useSyncOrchestrator() {
  const queryClient = useQueryClient();
  const { isConfigured } = useDiaProfile();
  const { dataSources } = useDataSources();
  const { periods } = useFirmaPeriods();
  const abortRef = useRef(false);
  
  const [progress, setProgress] = useState<SyncProgress>({
    isRunning: false,
    currentSource: null,
    currentPeriod: null,
    currentType: null,
    tasks: [],
    overallPercent: 0,
    totalFetched: 0,
    totalWritten: 0,
  });

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const callEdgeFunction = async (body: any, retryCount = 0): Promise<any> => {
    const token = await getAuthToken();
    if (!token) throw new Error('Oturum bulunamadı');

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dia-data-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      return result;
    } catch (e) {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 8000;
        console.log(`[SyncOrchestrator] Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return callEdgeFunction(body, retryCount + 1);
      }
      throw e;
    }
  };

  // Full sync: chunk bazlı, opsiyonel pageSize ve filters desteği
  const syncFullChunked = async (
    slug: string, periodNo: number, taskIndex: number, 
    options?: { pageSize?: number; filters?: any[] }
  ): Promise<{ fetched: number; written: number }> => {
    let offset = 0;
    let totalFetched = 0;
    let totalWritten = 0;
    let hasMore = true;
    const effectivePageSize = options?.pageSize;

    while (hasMore && !abortRef.current) {
      const result = await callEdgeFunction({
        action: 'syncChunk',
        dataSourceSlug: slug,
        periodNo,
        offset,
        chunkSize: CHUNK_SIZE,
        ...(effectivePageSize && { pageSize: effectivePageSize }),
        ...(options?.filters && { filters: options.filters }),
      });

      if (!result.success && !result.written) throw new Error(result.error || 'Chunk sync failed');

      totalFetched += result.fetched || 0;
      totalWritten += result.written || 0;
      hasMore = result.hasMore;
      offset = result.nextOffset || offset + CHUNK_SIZE;

      // Partial error (CancelledError sonrası kurtarma)
      if (result.partialError) {
        console.log(`[SyncOrchestrator] Partial error for ${slug}: ${result.partialError}, continuing...`);
      }

      // Task progress güncelle
      setProgress(prev => {
        const tasks = [...prev.tasks];
        if (tasks[taskIndex]) {
          tasks[taskIndex] = { ...tasks[taskIndex], fetched: totalFetched, written: totalWritten };
        }
        return { ...prev, tasks, totalFetched: prev.totalFetched + (result.fetched || 0), totalWritten: prev.totalWritten + (result.written || 0) };
      });
    }

    return { fetched: totalFetched, written: totalWritten };
  };

  // Incremental sync
  const syncIncremental = async (slug: string, periodNo: number): Promise<{ fetched: number; written: number; needsFullSync?: boolean }> => {
    const result = await callEdgeFunction({
      action: 'incrementalSync',
      dataSourceSlug: slug,
      periodNo,
    });

    if (result.needsFullSync) return { fetched: 0, written: 0, needsFullSync: true };
    if (!result.success) throw new Error(result.error || 'Incremental sync failed');

    return { fetched: result.fetched || 0, written: result.written || 0 };
  };

  // Aktif kaynakları filtrele (ortak yardımcı)
  const getActiveSources = () => {
    const NON_DIA = ['takvim', '_system_calendar', 'system_calendar'];
    return dataSources.filter(ds => 
      ds.is_active && !NON_DIA.includes(ds.slug) && !ds.slug.startsWith('_system') && !ds.is_non_dia
    );
  };

  // Tam orkestrasyon: tüm kaynakları ve dönemleri sırayla işle
  const startFullOrchestration = useCallback(async (forceIncremental = false) => {
    if (!isConfigured || progress.isRunning) return;
    abortRef.current = false;

    const activeSources = getActiveSources();

    if (activeSources.length === 0) {
      toast.info('Senkronize edilecek aktif veri kaynağı yok');
      return;
    }

    // Period sync status'ları çek
    const token = await getAuthToken();
    if (!token) { toast.error('Oturum bulunamadı'); return; }
    
    const statusRes = await callEdgeFunction({ action: 'getSyncStatus' });
    const periodStatuses = statusRes?.periodStatus || [];
    const currentPeriod = periods.find(p => p.is_current)?.period_no || statusRes?.currentPeriod;

    // Task listesi oluştur
    const tasks: SyncTask[] = [];
    for (const src of activeSources) {
      const srcPeriods = src.is_period_independent 
        ? [currentPeriod].filter(Boolean) 
        : periods.map(p => p.period_no);
      
      for (const pn of srcPeriods) {
        if (!pn) continue;
        const pss = periodStatuses.find((ps: any) => ps.data_source_slug === src.slug && ps.donem_kodu === pn);
        const isLocked = pss?.is_locked;
        const hasFullSync = pss?.last_full_sync;
        
        if (isLocked && !forceIncremental) {
          tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'skipped', type: 'full', fetched: 0, written: 0 });
        } else if (hasFullSync || forceIncremental) {
          // forceIncremental: Kullanıcı manuel artımlı sync istedi → her zaman _cdate/_date kontrolü yap
          tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'pending', type: 'incremental', fetched: 0, written: 0 });
        } else {
          tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'pending', type: 'full', fetched: 0, written: 0 });
        }
      }
    }

    setProgress({
      isRunning: true,
      currentSource: null,
      currentPeriod: null,
      currentType: null,
      tasks,
      overallPercent: 0,
      totalFetched: 0,
      totalWritten: 0,
    });

    const totalTasks = tasks.filter(t => t.status !== 'skipped').length;
    let completedTasks = 0;

    for (let i = 0; i < tasks.length; i++) {
      if (abortRef.current) break;
      const task = tasks[i];
      if (task.status === 'skipped') continue;

      setProgress(prev => ({
        ...prev,
        currentSource: task.name,
        currentPeriod: task.periodNo,
        currentType: task.type,
        tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'running' } : t),
      }));

      try {
        // KURAL: Tüm kaynaklar küçük pageSize ile çekilir
        const syncOptions = { pageSize: DEFAULT_PAGE_SIZE };

        if (task.type === 'full') {
          const result = await syncFullChunked(task.slug, task.periodNo, i, syncOptions);
          
          // Full sync tamamlandı → period_sync_status'a last_full_sync yaz
          if (result.fetched > 0) {
            await callEdgeFunction({ 
              action: 'markFullSyncComplete', 
              dataSourceSlug: task.slug, 
              periodNo: task.periodNo,
              totalRecords: result.fetched 
            });
          }
          
          // Aktif dönem değilse kilitle
          const isCurrentPeriod = task.periodNo === currentPeriod;
          if (!isCurrentPeriod && result.fetched > 0) {
            await callEdgeFunction({ action: 'lockPeriod', periodNo: task.periodNo, dataSourceSlug: task.slug });
          }

          setProgress(prev => ({
            ...prev,
            tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', fetched: result.fetched, written: result.written } : t),
          }));
        } else {
          const result = await syncIncremental(task.slug, task.periodNo);
          
           if (result.needsFullSync) {
            const fullResult = await syncFullChunked(task.slug, task.periodNo, i, syncOptions);
            if (fullResult.fetched > 0) {
              await callEdgeFunction({ action: 'markFullSyncComplete', dataSourceSlug: task.slug, periodNo: task.periodNo, totalRecords: fullResult.fetched });
            }
            setProgress(prev => ({
              ...prev,
              tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', type: 'full', fetched: fullResult.fetched, written: fullResult.written } : t),
            }));
          } else {
            setProgress(prev => ({
              ...prev,
              tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', fetched: result.fetched, written: result.written } : t),
            }));
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Bilinmeyen hata';
        const shouldSkip = SKIP_ERROR_PATTERNS.some(p => error.toLowerCase().includes(p.toLowerCase()));
        console.error(`[SyncOrchestrator] ${shouldSkip ? 'Skipping' : 'Error'} ${task.slug} period ${task.periodNo}:`, error);
        setProgress(prev => ({
          ...prev,
          tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: shouldSkip ? 'skipped' : 'failed', error } : t),
        }));
      }

      completedTasks++;
      setProgress(prev => ({
        ...prev,
        overallPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100,
      }));
    }

    // Tamamlandı
    setProgress(prev => ({
      ...prev,
      isRunning: false,
      currentSource: null,
      currentPeriod: null,
      currentType: null,
      overallPercent: 100,
    }));

    // Cache'leri invalidate et
    queryClient.invalidateQueries({ queryKey: ['company-data'] });
    queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    queryClient.invalidateQueries({ queryKey: ['cache-record-counts'] });
    queryClient.invalidateQueries({ queryKey: ['last-sync-time'] });

    const failedCount = tasks.filter(t => t.status === 'failed').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    if (failedCount === 0) {
      toast.success(`Senkronizasyon tamamlandı (${completedCount} görev)`);
    } else {
      toast.warning(`${completedCount} başarılı, ${failedCount} başarısız`);
    }
  }, [isConfigured, dataSources, periods, progress.isRunning, queryClient]);

  // Tek kaynak incremental sync (hızlı güncelleme)
  const quickSync = useCallback(async (slug: string, periodNo: number) => {
    if (progress.isRunning) return;
    const source = dataSources.find(ds => ds.slug === slug);
    if (!source) return;

    setProgress(prev => ({
      ...prev,
      isRunning: true,
      currentSource: source.name,
      currentPeriod: periodNo,
      currentType: 'incremental',
      tasks: [{ slug, name: source.name, periodNo, status: 'running', type: 'incremental', fetched: 0, written: 0 }],
      overallPercent: 0,
    }));

    try {
      const result = await syncIncremental(slug, periodNo);
      
      if (result.needsFullSync) {
        setProgress(prev => ({ ...prev, currentType: 'full', tasks: [{ ...prev.tasks[0], type: 'full' }] }));
        const fullResult = await syncFullChunked(slug, periodNo, 0);
        if (fullResult.fetched > 0) {
          await callEdgeFunction({ action: 'markFullSyncComplete', dataSourceSlug: slug, periodNo, totalRecords: fullResult.fetched });
        }
        toast.success(`${source.name}: ${fullResult.fetched} kayıt çekildi (tam sync)`);
      } else {
        toast.success(`${source.name}: ${result.fetched} yeni/güncellenen kayıt`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Hata';
      toast.error(`${source.name}: ${error}`);
    } finally {
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        currentSource: null,
        currentPeriod: null,
        currentType: null,
        overallPercent: 100,
      }));
      queryClient.invalidateQueries({ queryKey: ['company-data'] });
      queryClient.invalidateQueries({ queryKey: ['cache-record-counts'] });
      queryClient.invalidateQueries({ queryKey: ['last-sync-time'] });
    }
  }, [dataSources, progress.isRunning, queryClient]);

  const abort = useCallback(() => {
    abortRef.current = true;
    toast.info('Senkronizasyon durduruluyor...');
  }, []);

  // Artımlı senkronizasyon: tüm kaynaklar için _cdate/_date kontrolü
  const startIncrementalAll = useCallback(async () => {
    return startFullOrchestration(true);
  }, [startFullOrchestration]);

  return {
    progress,
    startFullOrchestration,
    startIncrementalAll,
    quickSync,
    abort,
  };
}
