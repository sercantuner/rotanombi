// DataManagementTab - Veri Yönetimi Sekmesi
// Veri kaynakları listesi, kayıt sayıları, dönem kilitleme ve sync butonları

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDataSources } from '@/hooks/useDataSources';
import { useSyncStatus } from '@/hooks/useSyncData';
import { useSyncOrchestratorContext } from '@/contexts/SyncOrchestratorContext';
import { supabase } from '@/integrations/supabase/client';

import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useCacheRecordCounts } from '@/hooks/useCacheRecordCounts';
import { usePeriodBasedRecordCounts } from '@/hooks/usePeriodBasedRecordCounts';
import { useFirmaPeriods } from '@/hooks/useFirmaPeriods';
import { useExcludedPeriods } from '@/hooks/useExcludedPeriods';
import {
  Database,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  CloudOff,
  HardDrive,
  Zap,
  BarChart3,
  Calendar,
  StopCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  SkipForward,
  Ban,
  Undo2,
  Search,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    case 'running': return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />;
    case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
    case 'skipped': return <SkipForward className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  }
}

function TaskTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'full': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1"><Layers className="w-2.5 h-2.5" />Tam</Badge>;
    case 'incremental': return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1"><Zap className="w-2.5 h-2.5" />Artımlı</Badge>;
    case 'reconcile': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-orange-500/30 text-orange-600"><Trash2 className="w-2.5 h-2.5" />Kontrol</Badge>;
    default: return null;
  }
}

export function DataManagementTab() {
  const { dataSources, isLoading: isDataSourcesLoading } = useDataSources();
  const { lastSyncTime, syncHistory, isLoading: isSyncStatusLoading } = useSyncStatus();
  const { progress, startFullOrchestration, quickSync, abort } = useSyncOrchestratorContext();
  const diaProfile = useDiaProfile();
  const { data: cacheRecordCounts, isLoading: isCacheCountsLoading } = useCacheRecordCounts();
  const { data: periodDistribution, isLoading: isPeriodDistLoading } = usePeriodBasedRecordCounts();
  const { periods } = useFirmaPeriods();
  const { excludePeriod, includePeriod, isExcluded, getExcludedPeriodsForSource } = useExcludedPeriods();
  const [expandedTasks, setExpandedTasks] = useState(true);
  const [expandedDistributions, setExpandedDistributions] = useState<Record<string, boolean>>({});
  const [diaRecordCounts, setDiaRecordCounts] = useState<Record<string, Record<number, number>>>({});
  const [loadingDiaCounts, setLoadingDiaCounts] = useState<Record<string, boolean>>({});
  const prevIsRunningRef = useRef(false);

  const activeDataSources = dataSources.filter(ds => ds.is_active);
  const getRecordCount = (slug: string) => cacheRecordCounts?.[slug] || 0;
  const currentPeriod = periods.find(p => p.is_current);

  // DIA'dan anlık kayıt sayısı çek
  const fetchDiaRecordCount = useCallback(async (dsSlug: string) => {
    if (!diaProfile.isConfigured || periods.length === 0) return;
    setLoadingDiaCounts(prev => ({ ...prev, [dsSlug]: true }));
    try {
      const sources = periods.map(p => ({ slug: dsSlug, periodNo: p.period_no }));
      const { data, error } = await supabase.functions.invoke('dia-data-sync', {
        body: {
          action: 'getRecordCounts',
          sources,
        },
      });
      if (error || !data?.success) throw new Error('DIA sayısı alınamadı');
      const byPeriod: Record<number, number> = {};
      for (const p of periods) {
        const key = `${dsSlug}_${p.period_no}`;
        byPeriod[p.period_no] = data.counts[key] || 0;
      }
      setDiaRecordCounts(prev => ({ ...prev, [dsSlug]: byPeriod }));
    } catch {
      // silent
    } finally {
      setLoadingDiaCounts(prev => ({ ...prev, [dsSlug]: false }));
    }
  }, [diaProfile.isConfigured, periods]);

  // Tüm kaynakların DIA sayılarını çek
  const fetchAllDiaCounts = useCallback(async () => {
    if (!diaProfile.isConfigured || periods.length === 0 || activeDataSources.length === 0) return;
    for (const ds of activeDataSources) {
      fetchDiaRecordCount(ds.slug);
    }
  }, [diaProfile.isConfigured, periods, activeDataSources, fetchDiaRecordCount]);

  // Sync bittiğinde otomatik DIA karşılaştırması
  useEffect(() => {
    if (prevIsRunningRef.current && !progress.isRunning) {
      // Sync bitti, DIA sayılarını güncelle
      fetchAllDiaCounts();
    }
    prevIsRunningRef.current = progress.isRunning;
  }, [progress.isRunning, fetchAllDiaCounts]);

  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Henüz senkronize edilmedi';
    try {
      return formatDistanceToNow(new Date(time), { addSuffix: true, locale: tr });
    } catch {
      return 'Bilinmiyor';
    }
  };

  if (!diaProfile.isConfigured) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CloudOff className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">DIA Bağlantısı Gerekli</h3>
          <p className="text-muted-foreground max-w-md">
            Veri yönetimi özelliğini kullanabilmek için önce DIA ERP bağlantınızı yapılandırın.
          </p>
        </div>
      </div>
    );
  }

  const completedTasks = progress.tasks.filter(t => t.status === 'completed');
  const failedTasks = progress.tasks.filter(t => t.status === 'failed');
  const skippedTasks = progress.tasks.filter(t => t.status === 'skipped');
  const pendingTasks = progress.tasks.filter(t => t.status === 'pending');
  const runningTask = progress.tasks.find(t => t.status === 'running');
  const activeTasks = progress.tasks.filter(t => t.status !== 'skipped');

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header Card */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Veri Senkronizasyonu</h3>
              <p className="text-sm text-muted-foreground">
                DIA'dan çekilen veriler yerel veritabanında saklanır • Her gece 03:00'te otomatik güncellenir
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {progress.isRunning ? (
              <Button onClick={abort} variant="destructive" className="gap-2">
                <StopCircle className="h-4 w-4" />
                Durdur
              </Button>
            ) : (
              <Button onClick={() => startFullOrchestration()} disabled={progress.isRunning} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tümünü Senkronize Et
              </Button>
            )}
          </div>
        </div>

        {/* Orchestrator Progress - Enhanced */}
        {progress.isRunning && (
          <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
            {/* Current task highlight */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {runningTask ? (
                  <>
                    {runningTask.name}
                    <Badge variant="outline" className="text-[10px]">D{runningTask.periodNo}</Badge>
                    <TaskTypeBadge type={runningTask.type} />
                  </>
                ) : 'Hazırlanıyor...'}
              </span>
              <span className="text-sm font-mono text-muted-foreground">%{progress.overallPercent}</span>
            </div>
            
            <Progress value={progress.overallPercent} className="h-2" />
            
            {/* Stats row */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowDownToLine className="h-3 w-3" />
                {progress.totalFetched.toLocaleString('tr-TR')}{progress.totalExpected > 0 ? ` / ${progress.totalExpected.toLocaleString('tr-TR')}` : ''} çekildi
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpFromLine className="h-3 w-3" />
                {progress.totalWritten.toLocaleString('tr-TR')} yazıldı
              </span>
              {progress.totalDeleted > 0 && (
                <span className="flex items-center gap-1 text-orange-500">
                  <Trash2 className="h-3 w-3" />
                  {progress.totalDeleted.toLocaleString('tr-TR')} silindi
                </span>
              )}
              <span className="ml-auto">
                {completedTasks.length}/{activeTasks.length} görev
              </span>
            </div>

            {/* Running task chunk detail */}
            {runningTask && (runningTask.fetched > 0 || runningTask.expectedRecords > 0) && (
              <div className="p-2 rounded bg-secondary/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {runningTask.name} • Dönem {runningTask.periodNo}
                    {runningTask.localRecords > 0 && runningTask.localRecords < runningTask.expectedRecords && (
                      <span className="text-primary/70 ml-1">(kaldığı yerden devam)</span>
                    )}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {(runningTask.localRecords + runningTask.fetched).toLocaleString('tr-TR')}{runningTask.expectedRecords > 0 ? ` / ${runningTask.expectedRecords.toLocaleString('tr-TR')}` : ''} kayıt
                  </span>
                </div>
                {runningTask.expectedRecords > 0 && (
                  <Progress value={Math.min(100, Math.round(((runningTask.localRecords + runningTask.fetched) / runningTask.expectedRecords) * 100))} className="h-1" />
                )}
              </div>
            )}

            {/* Collapsible task list */}
            <div>
              <button
                onClick={() => setExpandedTasks(!expandedTasks)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expandedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Tüm görevler ({activeTasks.length})
              </button>

              {expandedTasks && (
                <ScrollArea className="max-h-48 mt-2">
                  <div className="space-y-1">
                    {progress.tasks.map((task, idx) => (
                      <div
                        key={`${task.slug}-${task.periodNo}-${idx}`}
                        className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors ${
                          task.status === 'running' ? 'bg-primary/10 border border-primary/20' :
                          task.status === 'completed' ? 'bg-green-500/5' :
                          task.status === 'failed' ? 'bg-destructive/5' :
                          task.status === 'skipped' ? 'opacity-50' : ''
                        }`}
                      >
                        <TaskStatusIcon status={task.status} />
                        <span className="truncate flex-1 font-medium">{task.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">D{task.periodNo}</Badge>
                        <TaskTypeBadge type={task.type} />
                        
                        {/* Stats for completed/running tasks */}
                        {(task.status === 'completed' || task.status === 'running') && task.fetched > 0 && (
                          <span className="text-muted-foreground font-mono shrink-0 flex items-center gap-1.5">
                            <span className="flex items-center gap-0.5">
                              <ArrowDownToLine className="h-2.5 w-2.5" />{task.fetched}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ArrowUpFromLine className="h-2.5 w-2.5" />{task.written}
                            </span>
                            {task.deleted > 0 && (
                              <span className="flex items-center gap-0.5 text-orange-500">
                                <Trash2 className="h-2.5 w-2.5" />{task.deleted}
                              </span>
                            )}
                          </span>
                        )}

                        {task.status === 'failed' && task.error && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{task.error}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {task.status === 'skipped' && (
                          <span className="text-yellow-600 text-[10px]">Atlandı</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* Completed summary (after sync finishes) */}
        {!progress.isRunning && progress.tasks.length > 0 && progress.overallPercent === 100 && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Senkronizasyon Tamamlandı
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>✅ {completedTasks.length} başarılı</span>
              {failedTasks.length > 0 && <span className="text-destructive">❌ {failedTasks.length} başarısız</span>}
              {skippedTasks.length > 0 && <span className="text-yellow-600">⏭ {skippedTasks.length} atlandı</span>}
              <span>📥 {progress.totalFetched.toLocaleString('tr-TR')} çekildi</span>
              <span>📤 {progress.totalWritten.toLocaleString('tr-TR')} yazıldı</span>
              {progress.totalDeleted > 0 && <span>🗑 {progress.totalDeleted.toLocaleString('tr-TR')} silindi</span>}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-4 w-4" />
              <span className="text-xs">Veri Kaynakları</span>
            </div>
            <p className="text-2xl font-bold">{activeDataSources.length}</p>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Toplam Kayıt</span>
            </div>
            <p className="text-2xl font-bold">
              {isDataSourcesLoading || isCacheCountsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                activeDataSources.reduce((acc, ds) => acc + getRecordCount(ds.slug), 0).toLocaleString('tr-TR')
              )}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Son Senkronizasyon</span>
            </div>
            <p className="text-sm font-medium">
              {formatSyncTime(lastSyncTime)}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Aktif Dönem</span>
            </div>
            <p className="text-sm font-medium truncate">
              {currentPeriod ? `${currentPeriod.period_name || `D${currentPeriod.period_no}`}` : diaProfile.donemYili || diaProfile.donemKodu}
            </p>
          </div>
        </div>
      </div>

      {/* Data Sources List */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" />
            Veri Kaynakları ({activeDataSources.length})
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllDiaCounts}
            disabled={progress.isRunning || !diaProfile.isConfigured || periods.length === 0}
            className="gap-1.5 text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            DIA ile Karşılaştır
          </Button>
        </div>

        {isDataSourcesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeDataSources.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>Aktif veri kaynağı bulunamadı</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="space-y-2 pr-3">
              <TooltipProvider>
              {activeDataSources.map((ds) => {
                const recordCount = getRecordCount(ds.slug);
                const isCurrentlySyncing = progress.isRunning && progress.tasks.some(t => t.slug === ds.slug && t.status === 'running');
                const lastFetched = ds.last_fetched_at;
                const isDistributionExpanded = expandedDistributions[ds.slug];
                const distribution = periodDistribution?.[ds.slug];

                return (
                  <div key={ds.id} className="space-y-1">
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isCurrentlySyncing ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30 hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-1.5 rounded ${recordCount && recordCount > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
                          {isCurrentlySyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : recordCount && recordCount > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{ds.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{ds.module}/{ds.method}</span>
                            {ds.is_period_independent && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Dönem Bağımsız</Badge>
                            )}
                            {lastFetched && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatSyncTime(lastFetched)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {format(new Date(lastFetched), 'dd MMM yyyy HH:mm', { locale: tr })}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {recordCount !== null ? recordCount.toLocaleString('tr-TR') : '-'} kayıt
                        </Badge>

                        {/* DIA gerçek kayıt sayısı badge */}
                        {diaRecordCounts[ds.slug] && (() => {
                          const diaTotal = Object.values(diaRecordCounts[ds.slug]).reduce((s, c) => s + c, 0);
                          const isMatch = diaTotal === recordCount;
                          return (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge 
                                  variant={isMatch ? 'secondary' : 'destructive'} 
                                  className="font-mono text-[10px]"
                                >
                                  DIA: {diaTotal.toLocaleString('tr-TR')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isMatch
                                  ? 'DIA ile eşleşiyor ✓'
                                  : `Fark: ${(diaTotal - recordCount).toLocaleString('tr-TR')} kayıt`
                                }
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}

                        {/* DIA doğrulama butonu */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchDiaRecordCount(ds.slug)}
                              disabled={loadingDiaCounts[ds.slug] || progress.isRunning}
                              className="h-7 w-7 p-0"
                            >
                              {loadingDiaCounts[ds.slug] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Search className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>DIA'dan gerçek kayıt sayısını kontrol et</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="flex items-center gap-1">
                        {distribution && distribution.total > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedDistributions(prev => ({
                              ...prev,
                              [ds.slug]: !prev[ds.slug]
                            }))}
                            className="h-8 w-8 p-0"
                          >
                            {isDistributionExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const pn = currentPeriod?.period_no || parseInt(diaProfile.donemKodu || '0');
                                if (pn) quickSync(ds.slug, pn);
                              }}
                              disabled={isCurrentlySyncing || progress.isRunning}
                              className="h-8 w-8 p-0"
                            >
                              {isCurrentlySyncing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Zap className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Hızlı artımlı güncelleme</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Dönem Bazlı Dağılım */}
                    {isDistributionExpanded && distribution && distribution.total > 0 && (
                      <div className="ml-3 p-3 rounded-lg bg-secondary/20 border border-secondary/40">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">Dönem Bazlı Dağılım</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            Toplam: {distribution.total.toLocaleString('tr-TR')} kayıt
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(distribution.byPeriod)
                            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                            .map(([periodNo, count]) => {
                              const period = periods.find(p => p.period_no === parseInt(periodNo));
                              const percent = (count / distribution.total) * 100;
                              const periodNum = parseInt(periodNo);
                              const excluded = isExcluded(periodNum, ds.slug);
                              return (
                                <div key={periodNo} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      {period?.period_name || `D${periodNo}`}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono font-semibold">
                                        {count.toLocaleString('tr-TR')}
                                      </span>
                                      {diaRecordCounts[ds.slug]?.[periodNum] !== undefined && (
                                        <span className={`font-mono text-[10px] ${diaRecordCounts[ds.slug][periodNum] === count ? 'text-green-600' : 'text-destructive'}`}>
                                          ({diaRecordCounts[ds.slug][periodNum] === count ? '✓' : `DIA:${diaRecordCounts[ds.slug][periodNum]}`})
                                        </span>
                                      )}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 text-primary/70 hover:text-primary"
                                            disabled={progress.isRunning}
                                            onClick={() => quickSync(ds.slug, periodNum)}
                                          >
                                            {progress.isRunning && progress.tasks.some(t => t.slug === ds.slug && t.periodNo === periodNum && t.status === 'running') ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <RefreshCw className="h-3 w-3" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Bu dönemi güncelle</TooltipContent>
                                      </Tooltip>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive/70 hover:text-destructive">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Dönem Verilerini Sil</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              <strong>{ds.name}</strong> kaynağının <strong>Dönem {periodNo}</strong> verilerini ({count.toLocaleString('tr-TR')} kayıt) silmek istediğinize emin misiniz?
                                              <br /><br />
                                              Bu dönem bundan sonra senkronizasyondan da hariç tutulacaktır.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                            <AlertDialogAction
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              onClick={() => excludePeriod.mutate({ donemKodu: periodNum, dataSourceSlug: ds.slug })}
                                            >
                                              Sil ve Hariç Tut
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                  <Progress value={percent} className="h-1.5" />
                                  <div className="text-[10px] text-muted-foreground text-right">
                                    {percent.toFixed(1)}%
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Hariç tutulan dönemler */}
                        {(() => {
                          const excludedForSource = getExcludedPeriodsForSource(ds.slug)
                            .filter(pn => !distribution.byPeriod[pn]); // Verisi olmayan hariç tutulanlar
                          if (excludedForSource.length === 0) return null;
                          return (
                            <div className="mt-3 pt-3 border-t border-secondary/40">
                              <div className="flex items-center gap-2 mb-2">
                                <Ban className="h-3 w-3 text-destructive/60" />
                                <span className="text-[11px] text-destructive/80 font-medium">Hariç Tutulan Dönemler</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {excludedForSource.map(pn => {
                                  const period = periods.find(p => p.period_no === pn);
                                  return (
                                    <Badge key={pn} variant="outline" className="text-[10px] gap-1 border-destructive/30 text-destructive/80">
                                      <Ban className="h-2.5 w-2.5" />
                                      {period?.period_name || `D${pn}`}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 ml-0.5 text-muted-foreground hover:text-foreground"
                                        onClick={() => includePeriod.mutate({ donemKodu: pn, dataSourceSlug: ds.slug })}
                                      >
                                        <Undo2 className="h-2.5 w-2.5" />
                                      </Button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
              </TooltipProvider>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Sync History */}
      {syncHistory && syncHistory.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Son Senkronizasyonlar
          </h4>

          <ScrollArea className="h-[250px]">
            <div className="space-y-2 pr-3">
              {syncHistory.slice(0, 20).map((history: any) => (
                <div
                  key={history.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {history.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : history.status === 'failed' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    <span className="font-medium">{history.data_source_slug}</span>
                    <Badge variant="secondary" className="text-xs">
                      {history.sync_type === 'incremental' ? (
                        <><Zap className="w-3 h-3 mr-1" />Artımlı</>
                      ) : history.sync_type === 'full' ? 'Tam' : 'Tekil'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <span>+{history.records_inserted || 0} / ~{history.records_updated || 0}</span>
                    {(history.records_deleted || 0) > 0 && (
                      <span className="text-orange-500">-{history.records_deleted}</span>
                    )}
                    <span>{formatSyncTime(history.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <h4 className="font-medium text-primary mb-2">Senkronizasyon Mimarisi</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Chunk bazlı:</strong> Her kaynak 300'er kayıtlık parçalar halinde çekilir, timeout önlenir</li>
          <li>• <strong>İlk çekme:</strong> Tüm veriler tam sync ile çekilir, tamamlandığında dönem kilitlenir</li>
          <li>• <strong>Artımlı güncelleme:</strong> Sadece yeni ve değişen kayıtlar çekilir (⚡ hızlı)</li>
          <li>• <strong>Silinen kayıt tespiti:</strong> Her sync sonrası reconcileKeys ile DIA'da silinen kayıtlar tespit edilir</li>
          <li>• <strong>Otomatik:</strong> Her gece 03:00'te tüm sunucularda otomatik çalışır</li>
        </ul>
      </div>
    </div>
  );
}
