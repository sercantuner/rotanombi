// DataStatusIndicator - Kompakt köşe üçgen veri durumu göstergesi
// Widget'ın sağ alt köşesinde minimal üçgen olarak gösterilir

import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { DataStatus } from './DataStatusBadge';

interface DataStatusIndicatorProps {
  status: DataStatus;
  className?: string;
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

export function DataStatusIndicator({ status, className }: DataStatusIndicatorProps) {
  // Durum ve renk belirleme
  let colorClass = '';
  let tooltipTitle = '';
  let tooltipDetail = '';
  let showIndicator = true;

  // Hata durumu - Kırmızı
  if (status.error) {
    colorClass = 'border-b-destructive';
    tooltipTitle = 'Hata';
    tooltipDetail = status.error;
  }
  // Güncelleniyor - Primary/Mavi animasyonlu
  else if (status.isRevalidating) {
    colorClass = 'border-b-primary animate-pulse';
    tooltipTitle = 'Güncelleniyor';
    tooltipDetail = 'DIA\'dan veri çekiliyor...';
  }
  // Eski veri (> 24 saat) - Turuncu
  else if (status.source === 'cache' && isDataOld(status.lastSyncedAt)) {
    colorClass = 'border-b-orange-500';
    tooltipTitle = 'Eski Veri';
    tooltipDetail = `Son güncelleme: ${formatLastSync(status.lastSyncedAt)}`;
  }
  // Stale cache - Sarı
  else if (status.source === 'cache' && status.isStale) {
    colorClass = 'border-b-yellow-500';
    tooltipTitle = 'Önbellek';
    tooltipDetail = `Son güncelleme: ${formatLastSync(status.lastSyncedAt)}`;
  }
  // Taze veri (< 5 dk) - Yeşil
  else if (status.source === 'api' || isDataFresh(status.lastSyncedAt)) {
    colorClass = 'border-b-green-500';
    tooltipTitle = 'Güncel';
    tooltipDetail = `Son güncelleme: ${formatLastSync(status.lastSyncedAt)}`;
  }
  // Cache'den ama stale değil - gösterme
  else if (status.source === 'cache' && !status.isStale) {
    showIndicator = false;
  }
  // Pending - gösterme
  else if (status.source === 'pending') {
    showIndicator = false;
  }
  else {
    showIndicator = false;
  }

  if (!showIndicator) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "absolute bottom-0 right-0 w-0 h-0 cursor-help z-10",
              "border-l-[12px] border-l-transparent",
              "border-b-[12px]",
              colorClass,
              className
            )}
            style={{ 
              // Rounded corner için clip-path
              borderBottomRightRadius: 'inherit'
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[200px]">
          <p className="text-xs font-medium">{tooltipTitle}</p>
          <p className="text-xs text-muted-foreground">{tooltipDetail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
