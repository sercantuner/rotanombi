// SyncButton - Header'da kullanılacak senkronizasyon butonu
import React from 'react';
import { RefreshCw, Check, AlertCircle, Clock, Zap } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { useSyncStatus } from '@/hooks/useSyncData';
import { useSyncOrchestratorContext } from '@/contexts/SyncOrchestratorContext';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function SyncButton() {
  const { isConfigured } = useDiaProfile();
  const { lastSyncTime, syncHistory } = useSyncStatus();
  const { progress, startFullOrchestration, startIncrementalAll, quickSync, abort } = useSyncOrchestratorContext();

  if (!isConfigured) return null;

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Hiç senkronize edilmedi';
    return formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true, locale: tr });
  };

  const recentSyncs = (syncHistory || []).slice(0, 5);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={false}
              className="relative"
            >
              <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${progress.isRunning ? 'animate-spin' : ''}`} />
              {progress.isRunning && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Veri Senkronizasyonu</p>
          <p className="text-xs text-muted-foreground">{formatLastSync()}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Veri Senkronizasyonu</span>
          <span className="text-xs font-normal text-muted-foreground">
            {formatLastSync()}
          </span>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />

        {/* Progress göstergesi */}
        {progress.isRunning && (
          <div className="px-2 py-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium truncate flex-1">
                {progress.currentSource || 'Hazırlanıyor...'}
              </span>
              <span className="text-muted-foreground ml-2">
                {progress.currentType === 'incremental' ? '⚡ Artımlı' : '📦 Tam'} • %{progress.overallPercent}
              </span>
            </div>
            <Progress value={progress.overallPercent} className="h-1.5" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{progress.totalFetched} kayıt çekildi</span>
              <span>{progress.totalWritten} yazıldı</span>
            </div>
          </div>
        )}

        {progress.isRunning ? (
          <DropdownMenuItem onClick={abort} className="text-destructive">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>Senkronizasyonu Durdur</span>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => startIncrementalAll()}>
              <Zap className="w-4 h-4 mr-2" />
              <span>Güncel Verileri Getir</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => startFullOrchestration()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              <span>Tüm Verileri Senkronize Et</span>
            </DropdownMenuItem>
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
                  <Check className="w-3 h-3 mr-2 text-green-500" />
                ) : sync.status === 'failed' ? (
                  <AlertCircle className="w-3 h-3 mr-2 text-destructive" />
                ) : (
                  <Clock className="w-3 h-3 mr-2 text-yellow-500" />
                )}
                <span className="flex-1 truncate">{sync.data_source_slug}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {sync.sync_type === 'incremental' && <Zap className="w-3 h-3" />}
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
