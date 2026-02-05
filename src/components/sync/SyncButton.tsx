// SyncButton - Header'da kullanılacak senkronizasyon butonu
import React from 'react';
import { RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSyncData, useSyncStatus, useLastSyncTime } from '@/hooks/useCompanyData';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function SyncButton() {
  const { isConfigured } = useDiaProfile();
  const { data: syncStatus, isLoading: statusLoading } = useSyncStatus();
  const { mutate: syncData, isPending: isSyncing } = useSyncData();
  const lastSyncTime = useLastSyncTime();

  // DIA yapılandırılmamışsa gösterme
  if (!isConfigured) {
    return null;
  }

  const handleSyncAll = () => {
    syncData({ forceRefresh: false });
  };

  const handleSyncSource = (slug: string) => {
    syncData({ dataSourceSlug: slug, forceRefresh: false });
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Hiç senkronize edilmedi';
    return formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: tr });
  };

  // Son sync history'deki durumları göster
  const recentSyncs = syncStatus?.syncHistory?.slice(0, 5) || [];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isSyncing}
              className="relative"
            >
              <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              {syncStatus?.recordCounts && Object.keys(syncStatus.recordCounts).length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Veri Senkronizasyonu</p>
          <p className="text-xs text-muted-foreground">{formatLastSync()}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Veri Senkronizasyonu</span>
          <span className="text-xs font-normal text-muted-foreground">
            {formatLastSync()}
          </span>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSyncAll} disabled={isSyncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Tüm Verileri Senkronize Et</span>
        </DropdownMenuItem>

        {syncStatus?.recordCounts && Object.keys(syncStatus.recordCounts).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Veri Kaynakları
            </DropdownMenuLabel>
            {Object.entries(syncStatus.recordCounts).slice(0, 5).map(([slug, count]) => (
              <DropdownMenuItem key={slug} onClick={() => handleSyncSource(slug)}>
                <Check className="w-4 h-4 mr-2 text-success" />
                <span className="flex-1 truncate">{slug}</span>
                <span className="text-xs text-muted-foreground">{count} kayıt</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {recentSyncs.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Son İşlemler
            </DropdownMenuLabel>
            {recentSyncs.map((sync: any) => (
              <DropdownMenuItem key={sync.id} className="text-xs" disabled>
                {sync.status === 'completed' ? (
                  <Check className="w-3 h-3 mr-2 text-success" />
                ) : sync.status === 'failed' ? (
                  <AlertCircle className="w-3 h-3 mr-2 text-destructive" />
                ) : (
                  <Clock className="w-3 h-3 mr-2 text-warning" />
                )}
                <span className="flex-1 truncate">{sync.data_source_slug}</span>
                <span className="text-muted-foreground">
                  {sync.records_fetched || 0}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
