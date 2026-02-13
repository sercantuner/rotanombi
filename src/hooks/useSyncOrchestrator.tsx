// useSyncOrchestrator - Frontend orkestrasyon hook'u
// Chunk bazlı full sync, incremental sync, kilit mekanizması ve silinen kayıt tespiti

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useDataSources } from '@/hooks/useDataSources';
import { useFirmaPeriods } from '@/hooks/useFirmaPeriods';
import { useExcludedPeriods } from '@/hooks/useExcludedPeriods';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];
const DEFAULT_PAGE_SIZE = 100;
const SKIP_ERROR_PATTERNS = ['Session refresh fail', 'dönem yetki', 'INVALID_SESSION', '404'];

export interface SyncTask {
  slug: string;
  name: string;
  periodNo: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  type: 'full' | 'incremental' | 'reconcile';
  fetched: number;
  written: number;
  deleted: number;
  expectedRecords: number;
  localRecords: number;
  error?: string;
}

export interface SyncProgress {
  isRunning: boolean;
  currentSource: string | null;
  currentPeriod: number | null;
  currentType: 'full' | 'incremental' | 'reconcile' | null;
  tasks: SyncTask[];
  overallPercent: number;
  totalFetched: number;
  totalWritten: number;
  totalDeleted: number;
  totalExpected: number;
}

export function useSyncOrchestrator() {
  const queryClient = useQueryClient();
  const { isConfigured, sunucuAdi: profileSunucu, firmaKodu: profileFirma } = useDiaProfile();
  const { dataSources } = useDataSources();
  const { periods } = useFirmaPeriods();
  const { getExcludedPeriodsForSource } = useExcludedPeriods();
  const abortRef = useRef(false);
  const lockIdRef = useRef<string | null>(null);
  const targetUserIdRef = useRef<string | undefined>(undefined);
  
  const [progress, setProgress] = useState<SyncProgress>({
    isRunning: false,
    currentSource: null,
    currentPeriod: null,
    currentType: null,
    tasks: [],
    overallPercent: 0,
    totalFetched: 0,
    totalWritten: 0,
    totalDeleted: 0,
    totalExpected: 0,
  });

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const callEdgeFunction = async (body: any, retryCount = 0): Promise<any> => {
    const token = await getAuthToken();
    if (!token) throw new Error('Oturum bulunamadı');

    // Inject targetUserId if set (super admin mode)
    const payload = targetUserIdRef.current 
      ? { ...body, targetUserId: targetUserIdRef.current }
      : body;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dia-data-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
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

  // Kilit al
  const acquireLock = async (syncType: string, forceAcquire = false): Promise<{ success: boolean; lockId?: string; error?: string; lockedBy?: string }> => {
    try {
      const result = await callEdgeFunction({ action: 'acquireLock', syncType, forceAcquire });
      if (result.success) {
        lockIdRef.current = result.lockId;
        return { success: true, lockId: result.lockId };
      }
      return { success: false, error: result.error, lockedBy: result.lockedBy };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Lock error' };
    }
  };

  // Kilit bırak
  const releaseLock = async () => {
    try {
      if (lockIdRef.current) {
        await callEdgeFunction({ action: 'releaseLock', lockId: lockIdRef.current });
        lockIdRef.current = null;
      }
    } catch (e) {
      console.error('[SyncOrchestrator] releaseLock error:', e);
      lockIdRef.current = null;
    }
  };

  // Full sync: chunk bazlı
  const syncFullChunked = async (
    slug: string, periodNo: number, taskIndex: number, 
    options?: { pageSize?: number; filters?: any[]; startOffset?: number }
  ): Promise<{ fetched: number; written: number }> => {
    let offset = options?.startOffset || 0;
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

      if (result.partialError) {
        console.log(`[SyncOrchestrator] Partial error for ${slug}: ${result.partialError}, continuing...`);
      }

      setProgress(prev => {
        const tasks = [...prev.tasks];
        if (tasks[taskIndex]) {
          tasks[taskIndex] = { ...tasks[taskIndex], fetched: totalFetched, written: totalWritten };
        }
        const newTotalFetched = prev.totalFetched + (result.fetched || 0);
        const newTotalWritten = prev.totalWritten + (result.written || 0);
        const pct = prev.totalExpected > 0
          ? Math.min(99, Math.round((newTotalFetched / prev.totalExpected) * 100))
          : prev.overallPercent;
        return { ...prev, tasks, totalFetched: newTotalFetched, totalWritten: newTotalWritten, overallPercent: pct };
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

  // Silinen kayıt tespiti (reconcileKeys)
  const reconcileKeys = async (slug: string, periodNo: number): Promise<{ markedDeleted: number }> => {
    try {
      const result = await callEdgeFunction({
        action: 'reconcileKeys',
        dataSourceSlug: slug,
        periodNo,
      });

      if (!result.success) {
        console.log(`[SyncOrchestrator] reconcileKeys failed for ${slug} period ${periodNo}: ${result.error}`);
        return { markedDeleted: 0 };
      }

      console.log(`[SyncOrchestrator] reconcileKeys ${slug} period ${periodNo}: DIA=${result.totalInDia}, DB=${result.totalInDb}, deleted=${result.markedDeleted}`);
      return { markedDeleted: result.markedDeleted || 0 };
    } catch (e) {
      console.error(`[SyncOrchestrator] reconcileKeys error for ${slug}:`, e);
      return { markedDeleted: 0 };
    }
  };

  // Aktif kaynakları filtrele
  const getActiveSources = () => {
    const NON_DIA = ['takvim', '_system_calendar', 'system_calendar'];
    return dataSources.filter(ds => 
      ds.is_active && !NON_DIA.includes(ds.slug) && !ds.slug.startsWith('_system') && !ds.is_non_dia
    );
  };

  // Check if a source should skip reconcile (hash-key based sources)
  const shouldSkipReconcile = (slug: string): boolean => {
    const src = dataSources.find(ds => ds.slug === slug);
    return !!src?.skip_reconcile;
  };

  // Cache invalidation helper
  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['company-data'] });
    queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    queryClient.invalidateQueries({ queryKey: ['cache-record-counts'] });
    queryClient.invalidateQueries({ queryKey: ['last-sync-time'] });
    queryClient.invalidateQueries({ queryKey: ['period-based-record-counts'] });
    queryClient.invalidateQueries({ queryKey: ['data-sources'] });
  };

  // Lightweight invalidation during sync (just counts)
  const invalidateCountsDuringSync = () => {
    queryClient.invalidateQueries({ queryKey: ['cache-record-counts'] });
    queryClient.invalidateQueries({ queryKey: ['period-based-record-counts'] });
  };

  // Tam orkestrasyon
  const startFullOrchestration = useCallback(async (forceIncremental = false, targetUserId?: string) => {
    if ((!isConfigured && !targetUserId) || progress.isRunning) return;
    targetUserIdRef.current = targetUserId;
    abortRef.current = false;

    const activeSources = getActiveSources();
    if (activeSources.length === 0) {
      toast.info('Senkronize edilecek aktif veri kaynağı yok');
      return;
    }

    // Kilit al
    let lockResult = await acquireLock(forceIncremental ? 'incremental' : 'full');
    if (!lockResult.success && lockResult.error === 'SYNC_IN_PROGRESS' && targetUserId) {
      // Super admin impersonation mode - force acquire the lock
      console.log('[SyncOrchestrator] Lock blocked, force-acquiring as super admin...');
      lockResult = await acquireLock(forceIncremental ? 'incremental' : 'full', true);
    }
    if (!lockResult.success) {
      if (lockResult.error === 'SYNC_IN_PROGRESS') {
        toast.error(`Senkronizasyon zaten devam ediyor (${lockResult.lockedBy || 'başka kullanıcı'})`);
      } else {
        toast.error(`Kilit alınamadı: ${lockResult.error}`);
      }
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) { toast.error('Oturum bulunamadı'); return; }
      
      const statusRes = await callEdgeFunction({ action: 'getSyncStatus' });
      const periodStatuses = statusRes?.periodStatus || [];
      const currentPeriod = periods.find(p => p.is_current)?.period_no || statusRes?.currentPeriod;
      // Use sunucu/firma from edge function response (supports targetUserId)
      const effectiveSunucu = statusRes?.sunucuAdi || profileSunucu || '';
      const effectiveFirma = statusRes?.firmaKodu || profileFirma || '';

      // Task listesi oluştur (önce expected 0 ile, sonra DIA'dan güncellenecek)
      const tasks: SyncTask[] = [];
      const sourcesToCount: { slug: string; periodNo: number; taskIndex: number }[] = [];

      for (const src of activeSources) {
        // period_read_mode bazlı dönem seçimi:
        // current_only → sadece aktif dönem (masterdata: banka, cari kart, stok vb.)
        // all_periods → tüm dönemler (transaction: fatura, fiş vb.)
        const readMode = src.period_read_mode || 'all_periods';
        const srcPeriods = readMode === 'current_only' 
          ? [currentPeriod].filter(Boolean) 
          : periods.map(p => p.period_no);
        
        for (const pn of srcPeriods) {
          if (!pn) continue;
          const excludedPeriods = getExcludedPeriodsForSource(src.slug);
          if (excludedPeriods.includes(pn)) {
            console.log(`[SyncOrchestrator] Skipping excluded period ${pn} for ${src.slug}`);
            tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'skipped', type: 'full', fetched: 0, written: 0, deleted: 0, expectedRecords: 0, localRecords: 0, error: 'Hariç tutulan dönem' });
            continue;
          }
          const pss = periodStatuses.find((ps: any) => ps.data_source_slug === src.slug && ps.donem_kodu === pn);
          const isLocked = pss?.is_locked;
          const hasFullSync = pss?.last_full_sync;
          
          const taskIndex = tasks.length;
          if (isLocked && !forceIncremental) {
            tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'pending', type: 'reconcile', fetched: 0, written: 0, deleted: 0, expectedRecords: 0, localRecords: 0 });
          } else if (hasFullSync || forceIncremental) {
            tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'pending', type: 'incremental', fetched: 0, written: 0, deleted: 0, expectedRecords: 0, localRecords: 0 });
          } else {
            tasks.push({ slug: src.slug, name: src.name, periodNo: pn, status: 'pending', type: 'full', fetched: 0, written: 0, deleted: 0, expectedRecords: 0, localRecords: 0 });
          }
          if (tasks[taskIndex].type !== 'reconcile') {
            sourcesToCount.push({ slug: src.slug, periodNo: pn, taskIndex });
          }
        }
      }

      setProgress({
        isRunning: true,
        currentSource: 'Kayıt sayıları kontrol ediliyor...',
        currentPeriod: null,
        currentType: null,
        tasks,
        overallPercent: 0,
        totalFetched: 0,
        totalWritten: 0,
        totalDeleted: 0,
        totalExpected: 0,
      });

      // 1) DIA'dan gerçek kayıt sayılarını çek
      if (sourcesToCount.length > 0) {
        const BATCH_SIZE = 10;
        for (let b = 0; b < sourcesToCount.length; b += BATCH_SIZE) {
          const batch = sourcesToCount.slice(b, b + BATCH_SIZE);
          try {
            const countResult = await callEdgeFunction({
              action: 'getRecordCounts',
              sources: batch.map(s => ({ slug: s.slug, periodNo: s.periodNo })),
            });
            if (countResult?.success && countResult.counts) {
              for (const item of batch) {
                const key = `${item.slug}_${item.periodNo}`;
                tasks[item.taskIndex].expectedRecords = countResult.counts[key] || 0;
              }
            }
          } catch (e) {
            console.error('[SyncOrchestrator] getRecordCounts error:', e);
          }
        }
      }

      // 2) DB'deki mevcut kayıt sayılarını çek (dönem bazlı)
      for (const item of sourcesToCount) {
        try {
          const { count } = await supabase
            .from('company_data_cache')
            .select('*', { count: 'exact', head: true })
            .eq('sunucu_adi', effectiveSunucu)
            .eq('firma_kodu', effectiveFirma)
            .eq('data_source_slug', item.slug)
            .eq('donem_kodu', item.periodNo)
            .eq('is_deleted', false);
          tasks[item.taskIndex].localRecords = count || 0;
        } catch (e) {
          console.error(`[SyncOrchestrator] Local count error for ${item.slug}:`, e);
        }
      }

      // 3) Karşılaştır: DIA vs DB → task type'ı güncelle
      for (const item of sourcesToCount) {
        const task = tasks[item.taskIndex];
        if (task.expectedRecords > 0 && task.localRecords >= task.expectedRecords) {
          // DB zaten tamamlanmış, sadece reconcile yap
          console.log(`[SyncOrchestrator] ${task.slug} D${task.periodNo}: DB(${task.localRecords}) >= DIA(${task.expectedRecords}), skipping to reconcile`);
          task.type = 'reconcile';
        } else if (task.expectedRecords > 0 && task.localRecords > 0 && task.localRecords < task.expectedRecords) {
          // Yarım kalmış, kaldığı yerden devam et (full sync with offset)
          console.log(`[SyncOrchestrator] ${task.slug} D${task.periodNo}: DB(${task.localRecords}) < DIA(${task.expectedRecords}), resuming from offset ${task.localRecords}`);
          task.type = 'full'; // Kaldığı yerden devam edecek
        }
      }

      const totalExpected = tasks.reduce((sum, t) => sum + t.expectedRecords, 0);
      const totalLocal = tasks.reduce((sum, t) => sum + t.localRecords, 0);
      console.log(`[SyncOrchestrator] DIA total: ${totalExpected}, DB total: ${totalLocal}, delta: ${totalExpected - totalLocal}`);

      setProgress(prev => ({
        ...prev,
        currentSource: null,
        tasks: [...tasks],
        totalExpected,
        // Mevcut local kayıtları da fetched olarak say (ilerlemeye dahil et)
        totalFetched: totalLocal,
      }));

      const totalTasks = tasks.length;
      let completedTasks = 0;

      for (let i = 0; i < tasks.length; i++) {
        if (abortRef.current) break;
        const task = tasks[i];

        setProgress(prev => ({
          ...prev,
          currentSource: task.name,
          currentPeriod: task.periodNo,
          currentType: task.type,
          tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'running' } : t),
        }));

        try {
          // Yarım kalmış veri varsa kaldığı yerden devam et
          const resumeOffset = (task.type === 'full' && task.localRecords > 0 && task.expectedRecords > task.localRecords) 
            ? task.localRecords : 0;
          const syncOptions = { pageSize: DEFAULT_PAGE_SIZE, startOffset: resumeOffset };

          if (resumeOffset > 0) {
            console.log(`[SyncOrchestrator] Resuming ${task.slug} D${task.periodNo} from offset ${resumeOffset} (local: ${task.localRecords}, expected: ${task.expectedRecords})`);
          }

          if (task.type === 'reconcile') {
            // Kilitli dönem veya tamamlanmış: sadece silinen kayıt kontrolü
            let recResult = { markedDeleted: 0 };
            if (!shouldSkipReconcile(task.slug)) {
              recResult = await reconcileKeys(task.slug, task.periodNo);
            }
            setProgress(prev => ({
              ...prev,
              tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', deleted: recResult.markedDeleted } : t),
              totalDeleted: prev.totalDeleted + recResult.markedDeleted,
            }));
            invalidateCountsDuringSync();
          } else if (task.type === 'full') {
            const result = await syncFullChunked(task.slug, task.periodNo, i, syncOptions);
            
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

            // Sync sonrası silinen kayıt kontrolü
            let deletedCount = 0;
            if (!abortRef.current && !shouldSkipReconcile(task.slug)) {
              const recResult = await reconcileKeys(task.slug, task.periodNo);
              deletedCount = recResult.markedDeleted;
            }

            setProgress(prev => ({
              ...prev,
              tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', fetched: result.fetched, written: result.written, deleted: deletedCount } : t),
              totalDeleted: prev.totalDeleted + deletedCount,
            }));
            invalidateCountsDuringSync();
          } else {
            // Incremental
            const result = await syncIncremental(task.slug, task.periodNo);
            
            if (result.needsFullSync) {
              const fullResult = await syncFullChunked(task.slug, task.periodNo, i, syncOptions);
              if (fullResult.fetched > 0) {
                await callEdgeFunction({ action: 'markFullSyncComplete', dataSourceSlug: task.slug, periodNo: task.periodNo, totalRecords: fullResult.fetched });
              }

              // Full sync sonrası reconcile
              let deletedCount = 0;
              if (!abortRef.current && !shouldSkipReconcile(task.slug)) {
                const recResult = await reconcileKeys(task.slug, task.periodNo);
                deletedCount = recResult.markedDeleted;
              }

              setProgress(prev => ({
                ...prev,
                tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', type: 'full', fetched: fullResult.fetched, written: fullResult.written, deleted: deletedCount } : t),
                totalDeleted: prev.totalDeleted + deletedCount,
              }));
              invalidateCountsDuringSync();
            } else {
              // Incremental sonrası reconcile
              let deletedCount = 0;
              if (!abortRef.current && !shouldSkipReconcile(task.slug)) {
                const recResult = await reconcileKeys(task.slug, task.periodNo);
                deletedCount = recResult.markedDeleted;
              }

              setProgress(prev => ({
                ...prev,
                tasks: prev.tasks.map((t, idx) => idx === i ? { ...t, status: 'completed', fetched: result.fetched, written: result.written, deleted: deletedCount } : t),
                totalDeleted: prev.totalDeleted + deletedCount,
              }));
              invalidateCountsDuringSync();
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
        setProgress(prev => {
          // Calculate percent based on fetched records vs expected, fallback to task-based
          const pct = prev.totalExpected > 0
            ? Math.min(99, Math.round((prev.totalFetched / prev.totalExpected) * 100))
            : totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
          return { ...prev, overallPercent: pct };
        });
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

      invalidateCaches();

      // Trigger snapshot computation after sync
      try {
        console.log('[SyncOrchestrator] Triggering widget-compute for snapshots...');
        const token = await getAuthToken();
        if (token) {
          const computeBody: any = {
            sunucuAdi: effectiveSunucu,
            firmaKodu: effectiveFirma,
            syncTrigger: 'post_sync',
          };
          await fetch(`${SUPABASE_URL}/functions/v1/widget-compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(computeBody),
          }).then(r => r.json()).then(r => {
            console.log('[SyncOrchestrator] widget-compute result:', r.success ? 'OK' : r.error);
          }).catch(e => {
            console.error('[SyncOrchestrator] widget-compute error:', e);
          });
        }
      } catch (e) {
        console.error('[SyncOrchestrator] Snapshot trigger error:', e);
      }

      const failedCount = tasks.filter(t => t.status === 'failed').length;
      const completedCount = tasks.filter(t => t.status === 'completed').length;
      const totalDeleted = tasks.reduce((sum, t) => sum + t.deleted, 0);
      
      if (failedCount === 0) {
        toast.success(`Senkronizasyon tamamlandı (${completedCount} görev${totalDeleted > 0 ? `, ${totalDeleted} silinen kayıt tespit edildi` : ''})`);
      } else {
        toast.warning(`${completedCount} başarılı, ${failedCount} başarısız`);
      }
    } finally {
      await releaseLock();
      targetUserIdRef.current = undefined;
    }
  }, [isConfigured, dataSources, periods, progress.isRunning, queryClient]);

  // Tek kaynak incremental sync (hızlı güncelleme) + resume-from-offset
  const quickSync = useCallback(async (slug: string, periodNo: number, targetUserId?: string) => {
    if (progress.isRunning) return;
    targetUserIdRef.current = targetUserId;
    const source = dataSources.find(ds => ds.slug === slug);
    if (!source) return;

    // Kilit al
    let lockResult = await acquireLock('incremental');
    if (!lockResult.success && lockResult.error === 'SYNC_IN_PROGRESS' && targetUserId) {
      console.log('[SyncOrchestrator] quickSync: Lock blocked, force-acquiring as super admin...');
      lockResult = await acquireLock('incremental', true);
    }
    if (!lockResult.success) {
      if (lockResult.error === 'SYNC_IN_PROGRESS') {
        toast.error(`Senkronizasyon zaten devam ediyor (${lockResult.lockedBy || 'başka kullanıcı'})`);
      } else {
        toast.error(`Kilit alınamadı: ${lockResult.error}`);
      }
      return;
    }

    // DIA'dan gerçek kayıt sayısını çek
    let expected = 0;
    try {
      const countResult = await callEdgeFunction({
        action: 'getRecordCounts',
        sources: [{ slug, periodNo }],
      });
      if (countResult?.success && countResult.counts) {
        expected = countResult.counts[`${slug}_${periodNo}`] || 0;
      }
    } catch (e) {
      console.error('[SyncOrchestrator] quickSync getRecordCounts error:', e);
    }

    // DB'deki mevcut kayıt sayısını çek
    // Use edge function response for sunucu/firma when impersonating
    let effectiveSunucu = profileSunucu || '';
    let effectiveFirma = profileFirma || '';
    if (targetUserId) {
      try {
        const statusRes = await callEdgeFunction({ action: 'getSyncStatus' });
        effectiveSunucu = statusRes?.sunucuAdi || effectiveSunucu;
        effectiveFirma = statusRes?.firmaKodu || effectiveFirma;
      } catch {}
    }

    let localCount = 0;
    try {
      const { count } = await supabase
        .from('company_data_cache')
        .select('*', { count: 'exact', head: true })
        .eq('sunucu_adi', effectiveSunucu)
        .eq('firma_kodu', effectiveFirma)
        .eq('data_source_slug', slug)
        .eq('donem_kodu', periodNo)
        .eq('is_deleted', false);
      localCount = count || 0;
    } catch (e) {
      console.error('[SyncOrchestrator] quickSync local count error:', e);
    }

    // Eksik kayıt var mı kontrol et
    const hasGap = expected > 0 && localCount < expected;
    const syncType = hasGap ? 'full' : 'incremental';
    
    if (hasGap) {
      console.log(`[SyncOrchestrator] quickSync: DB(${localCount}) < DIA(${expected}) for ${slug} D${periodNo}, will resume from offset ${localCount}`);
    }

    setProgress(prev => ({
      ...prev,
      isRunning: true,
      currentSource: source.name,
      currentPeriod: periodNo,
      currentType: syncType,
      tasks: [{ slug, name: source.name, periodNo, status: 'running', type: syncType, fetched: 0, written: 0, deleted: 0, expectedRecords: expected, localRecords: localCount }],
      overallPercent: 0,
      totalExpected: expected,
      totalFetched: hasGap ? localCount : 0,
      totalWritten: 0,
    }));

    try {
      if (hasGap) {
        // Eksik kayıtları offset'ten devam ederek tamamla
        toast.info(`${source.name}: ${localCount}/${expected} mevcut, eksik ${expected - localCount} kayıt tamamlanıyor...`);
        const fullResult = await syncFullChunked(slug, periodNo, 0, { pageSize: DEFAULT_PAGE_SIZE, startOffset: localCount });
        
        if (fullResult.fetched > 0) {
          await callEdgeFunction({ action: 'markFullSyncComplete', dataSourceSlug: slug, periodNo, totalRecords: localCount + fullResult.fetched });
        }
        
        // Reconcile (skip for hash-key sources)
        let recResult = { markedDeleted: 0 };
        if (!shouldSkipReconcile(slug)) {
          recResult = await reconcileKeys(slug, periodNo);
        }
        toast.success(`${source.name}: ${fullResult.fetched} eksik kayıt tamamlandı (toplam: ${localCount + fullResult.fetched})${recResult.markedDeleted > 0 ? `, ${recResult.markedDeleted} silinen tespit edildi` : ''}`);
      } else {
        // Normal incremental sync
        const result = await syncIncremental(slug, periodNo);
        
        if (result.needsFullSync) {
          setProgress(prev => ({ ...prev, currentType: 'full', tasks: [{ ...prev.tasks[0], type: 'full' }] }));
          const fullResult = await syncFullChunked(slug, periodNo, 0);
          if (fullResult.fetched > 0) {
            await callEdgeFunction({ action: 'markFullSyncComplete', dataSourceSlug: slug, periodNo, totalRecords: fullResult.fetched });
          }
          let recResult = { markedDeleted: 0 };
          if (!shouldSkipReconcile(slug)) {
            recResult = await reconcileKeys(slug, periodNo);
          }
          toast.success(`${source.name}: ${fullResult.fetched} kayıt çekildi (tam sync)${recResult.markedDeleted > 0 ? `, ${recResult.markedDeleted} silinen tespit edildi` : ''}`);
        } else {
          let recResult = { markedDeleted: 0 };
          if (!shouldSkipReconcile(slug)) {
            recResult = await reconcileKeys(slug, periodNo);
          }
          toast.success(`${source.name}: ${result.fetched} yeni/güncellenen kayıt${recResult.markedDeleted > 0 ? `, ${recResult.markedDeleted} silinen tespit edildi` : ''}`);
        }
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
      await releaseLock();
      targetUserIdRef.current = undefined;
      invalidateCaches();
    }
  }, [dataSources, progress.isRunning, queryClient]);

  const abort = useCallback(() => {
    abortRef.current = true;
    toast.info('Senkronizasyon durduruluyor...');
  }, []);

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
