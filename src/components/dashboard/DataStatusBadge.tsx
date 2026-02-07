// DataStatusBadge - Widget veri durumu göstergesi
// Stale-While-Revalidate stratejisinin görsel karşılığı

import React from 'react';
import { RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export interface DataStatus {
  source: 'cache' | 'api' | 'pending';
  lastSyncedAt: Date | null;
  isStale: boolean;
  isRevalidating: boolean;
  error?: string | null;
}

interface DataStatusBadgeProps {
  status: DataStatus;
  className?: string;
  compact?: boolean; // Sadece ikon göster
}

// Son güncelleme zamanını formatla
function formatLastSync(date: Date | null): string {
  if (!date) return 'Bilinmiyor';
  return formatDistanceToNow(date, { addSuffix: true, locale: tr });
}

// Veri yaşını kontrol et (> 24 saat = eski)
function isDataOld(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return false;
  const hoursSinceSync = (Date.now() - lastSyncedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceSync > 24;
}

// Veri taze mi kontrol et (< 5 dakika)
function isDataFresh(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return false;
  const minutesSinceSync = (Date.now() - lastSyncedAt.getTime()) / (1000 * 60);
  return minutesSinceSync < 5;
}

export function DataStatusBadge({ status, className, compact = false }: DataStatusBadgeProps) {
  // Hata durumu
  if (status.error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="destructive" 
              className={cn(
                "text-xs gap-1 cursor-help",
                compact && "px-1.5",
                className
              )}
            >
              <XCircle className="h-3 w-3" />
              {!compact && <span>Hata</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <p className="text-xs">{status.error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Arka planda güncelleniyor
  if (status.isRevalidating) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs gap-1 cursor-help animate-pulse",
                compact && "px-1.5",
                className
              )}
            >
              <RefreshCw className="h-3 w-3 animate-spin" />
              {!compact && <span>Güncelleniyor</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">DIA'dan yeni veri çekiliyor...</p>
            {status.lastSyncedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Son güncelleme: {formatLastSync(status.lastSyncedAt)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Veri eski (> 24 saat)
  if (status.source === 'cache' && isDataOld(status.lastSyncedAt)) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs gap-1 cursor-help border-orange-500/50 text-orange-600 dark:text-orange-400",
                compact && "px-1.5",
                className
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {!compact && <span>Eski</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Son güncelleme 24 saatten önce</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatLastSync(status.lastSyncedAt)}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Cache'den gösteriliyor (stale)
  if (status.source === 'cache' && status.isStale) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs gap-1 cursor-help border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
                compact && "px-1.5",
                className
              )}
            >
              <Clock className="h-3 w-3" />
              {!compact && <span>Önbellek</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Önbellekten gösteriliyor</p>
            {status.lastSyncedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Son güncelleme: {formatLastSync(status.lastSyncedAt)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Güncel veri (< 5 dakika)
  if (status.source === 'api' || isDataFresh(status.lastSyncedAt)) {
    // Taze veri için badge gösterme (minimal UI)
    // Opsiyonel: Küçük yeşil badge göster
    if (compact) return null;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs gap-1 cursor-help border-green-500/50 text-green-600 dark:text-green-400",
                className
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Güncel</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Veri güncel</p>
            {status.lastSyncedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Son güncelleme: {formatLastSync(status.lastSyncedAt)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Cache'den gösteriliyor ama stale değil
  if (status.source === 'cache' && !status.isStale) {
    return null; // Stale değilse badge gösterme
  }

  // Varsayılan - pending durumu veya diğer
  if (status.source === 'pending') {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "text-xs gap-1",
          compact && "px-1.5",
          className
        )}
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        {!compact && <span>Yükleniyor</span>}
      </Badge>
    );
  }

  return null;
}
