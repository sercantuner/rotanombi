// DataManagementTab - Veri Yönetimi Sekmesi
// Veri kaynakları listesi, kayıt sayıları, dönem kilitleme ve sync butonları

import React from 'react';
import { useDataSources } from '@/hooks/useDataSources';
import { useSyncStatus } from '@/hooks/useSyncData';
import { useSyncOrchestrator } from '@/hooks/useSyncOrchestrator';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useCacheRecordCounts } from '@/hooks/useCacheRecordCounts';
import { useFirmaPeriods } from '@/hooks/useFirmaPeriods';
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
  Lock,
  Unlock,
  StopCircle,
} from 'lucide-react';
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

export function DataManagementTab() {
  const { dataSources, isLoading: isDataSourcesLoading } = useDataSources();
  const { lastSyncTime, syncHistory, isLoading: isSyncStatusLoading } = useSyncStatus();
  const { progress, startFullOrchestration, quickSync, abort } = useSyncOrchestrator();
  const diaProfile = useDiaProfile();
  const { data: cacheRecordCounts, isLoading: isCacheCountsLoading } = useCacheRecordCounts();
  const { periods } = useFirmaPeriods();

  const activeDataSources = dataSources.filter(ds => ds.is_active);
  const getRecordCount = (slug: string) => cacheRecordCounts?.[slug] || 0;
  const currentPeriod = periods.find(p => p.is_current);

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

        {/* Orchestrator Progress */}
        {progress.isRunning && (
          <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {progress.currentSource || 'Hazırlanıyor...'}
                {progress.currentType === 'incremental' && (
                  <Badge variant="secondary" className="text-xs"><Zap className="w-3 h-3 mr-1" />Artımlı</Badge>
                )}
                {progress.currentType === 'full' && (
                  <Badge variant="outline" className="text-xs">Tam Sync</Badge>
                )}
              </span>
              <span className="text-sm text-muted-foreground">%{progress.overallPercent}</span>
            </div>
            <Progress value={progress.overallPercent} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.totalFetched.toLocaleString('tr-TR')} kayıt çekildi</span>
              <span>{progress.totalWritten.toLocaleString('tr-TR')} yazıldı</span>
              <span>
                {progress.tasks.filter(t => t.status === 'completed').length}/{progress.tasks.filter(t => t.status !== 'skipped').length} görev
              </span>
            </div>

            {/* Task mini list */}
            {progress.tasks.filter(t => t.status !== 'skipped').length > 1 && (
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {progress.tasks.filter(t => t.status !== 'skipped').map((task, idx) => (
                  <div key={`${task.slug}-${task.periodNo}-${idx}`} className="flex items-center gap-2 text-xs">
                    {task.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
                    {task.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                    {task.status === 'failed' && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                    {task.status === 'pending' && <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="truncate flex-1">{task.name} (D{task.periodNo})</span>
                    {task.fetched > 0 && <span className="text-muted-foreground">{task.fetched}</span>}
                  </div>
                ))}
              </div>
            )}
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
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Database className="h-4 w-4" />
          Veri Kaynakları
        </h4>

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
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              <TooltipProvider>
              {activeDataSources.map((ds) => {
                const recordCount = getRecordCount(ds.slug);
                const isCurrentlySyncing = progress.isRunning && progress.tasks.some(t => t.slug === ds.slug && t.status === 'running');
                const lastFetched = ds.last_fetched_at;

                return (
                  <div
                    key={ds.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-1.5 rounded ${recordCount && recordCount > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
                        {recordCount && recordCount > 0 ? (
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

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {recordCount !== null ? recordCount.toLocaleString('tr-TR') : '-'} kayıt
                      </Badge>

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

          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {syncHistory.slice(0, 10).map((history: any) => (
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
        <h4 className="font-medium text-primary mb-2">Artımlı Senkronizasyon</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>İlk çekme:</strong> Tüm veriler küçük parçalar halinde çekilir ve dönem kilitlenir</li>
          <li>• <strong>Günlük güncelleme:</strong> Sadece yeni (_cdate) ve değişen (_date) kayıtlar çekilir</li>
          <li>• <strong>Otomatik:</strong> Her gece 03:00'te tüm sunucularda otomatik çalışır</li>
          <li>• <strong>Hızlı güncelleme (⚡):</strong> Anlık artımlı sync ile en güncel veriye erişin</li>
        </ul>
      </div>
    </div>
  );
}
