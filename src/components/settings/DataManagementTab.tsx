// DataManagementTab - Veri Yönetimi Sekmesi
// Veri kaynakları listesi, kayıt sayıları ve sync butonları

import React, { useState } from 'react';
import { useDataSources } from '@/hooks/useDataSources';
import { useSyncData, useSyncStatus } from '@/hooks/useSyncData';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useCacheRecordCounts } from '@/hooks/useCacheRecordCounts';
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
  const { syncDataSource, syncAllDataSources, isSyncing, currentSyncSource, syncProgress } = useSyncData();
  const { lastSyncTime, syncHistory, isLoading: isSyncStatusLoading } = useSyncStatus();
  const diaProfile = useDiaProfile();
  const { data: cacheRecordCounts, isLoading: isCacheCountsLoading } = useCacheRecordCounts();

  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);

  const activeDataSources = dataSources.filter(ds => ds.is_active);

  // Kayıt sayısını cache'den al (gerçek değer)
  const getRecordCount = (slug: string) => cacheRecordCounts?.[slug] || 0;

  // Tek veri kaynağını senkronize et
  const handleSyncSource = async (dataSourceSlug: string, sourceId: string) => {
    setSyncingSourceId(sourceId);
    try {
      await syncDataSource(dataSourceSlug);
    } finally {
      setSyncingSourceId(null);
    }
  };

  // Tüm veri kaynaklarını senkronize et
  const handleSyncAll = async () => {
    await syncAllDataSources();
  };

  // Son sync zamanını formatla
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
                DIA'dan çekilen veriler yerel veritabanında saklanır
              </p>
            </div>
          </div>

          <Button
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Senkronize Ediliyor...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Tümünü Senkronize Et
              </>
            )}
          </Button>
        </div>

        {/* Sync Progress */}
        {isSyncing && currentSyncSource && (
          <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {currentSyncSource} senkronize ediliyor...
              </span>
              <span className="text-sm text-muted-foreground">{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
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
              <Zap className="h-4 w-4" />
              <span className="text-xs">Firma / Dönem</span>
            </div>
            <p className="text-sm font-medium truncate">
              {diaProfile.firmaAdi || diaProfile.firmaKodu} / {diaProfile.donemYili || diaProfile.donemKodu}
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
                  const isCurrentlySyncing = syncingSourceId === ds.id || (isSyncing && currentSyncSource === ds.name);
                  const lastFetched = ds.last_fetched_at;

                  return (
                    <div
                      key={ds.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status Icon */}
                        <div className={`p-1.5 rounded ${recordCount && recordCount > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
                          {recordCount && recordCount > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Source Info */}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{ds.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{ds.module}/{ds.method}</span>
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

                      {/* Record Count Badge */}
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {recordCount !== null ? recordCount.toLocaleString('tr-TR') : '-'} kayıt
                        </Badge>

                        {/* Sync Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncSource(ds.slug, ds.id)}
                          disabled={isCurrentlySyncing || isSyncing}
                          className="h-8 w-8 p-0"
                        >
                          {isCurrentlySyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
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
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    <span className="font-medium">{history.data_source_slug}</span>
                    <Badge variant="secondary" className="text-xs">
                      {history.sync_type === 'full' ? 'Tam' : 'Artımlı'}
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
        <h4 className="font-medium text-primary mb-2">Senkronizasyon Hakkında</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Veriler DIA API'den çekilip yerel veritabanında saklanır</li>
          <li>• Geçmiş dönemler bir kez çekilir ve kilitlenir (kontör tasarrufu)</li>
          <li>• Aktif dönemde son 2 aylık veriler artımlı güncellenir</li>
          <li>• Her kayıt _key değerine göre güncellenir veya eklenir</li>
        </ul>
      </div>
    </div>
  );
}
