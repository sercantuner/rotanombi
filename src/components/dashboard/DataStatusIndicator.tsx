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

// DataStatus interface - Stale-While-Revalidate stratejisi için veri durumu
export interface DataStatus {
  source: 'cache' | 'api' | 'pending';
  lastSyncedAt: Date | null;
  isStale: boolean;
  isRevalidating: boolean;
  error?: string | null;
}

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
  let fillColor = '';
  let tooltipTitle = '';
  let tooltipDetail = '';
  let showIndicator = true;
  let isAnimating = false;

  // Hata durumu - Kırmızı
  if (status.error) {
    fillColor = 'rgb(239 68 68)'; // red-500
    tooltipTitle = 'Hata';
    tooltipDetail = status.error;
  }
  // Güncelleniyor - Primary/Mavi animasyonlu
  else if (status.isRevalidating) {
    fillColor = 'hsl(var(--primary))';
    tooltipTitle = 'Güncelleniyor';
    tooltipDetail = 'DIA\'dan veri çekiliyor...';
    isAnimating = true;
  }
  // Eski veri (> 24 saat) - Turuncu
  else if (status.source === 'cache' && isDataOld(status.lastSyncedAt)) {
    fillColor = 'rgb(249 115 22)'; // orange-500
    tooltipTitle = 'Eski Veri';
    tooltipDetail = `Son güncelleme: ${formatLastSync(status.lastSyncedAt)}`;
  }
  // Stale cache - Sarı
  else if (status.source === 'cache' && status.isStale) {
    fillColor = 'rgb(234 179 8)'; // yellow-500
    tooltipTitle = 'Önbellek';
    tooltipDetail = `Son güncelleme: ${formatLastSync(status.lastSyncedAt)}`;
  }
  // Taze veri (< 5 dk) veya stale olmayan cache - Yeşil (her zaman göster)
  else if (status.source === 'api' || isDataFresh(status.lastSyncedAt) || (status.source === 'cache' && !status.isStale)) {
    fillColor = 'rgb(34 197 94)'; // green-500
    tooltipTitle = 'Güncel';
    tooltipDetail = status.lastSyncedAt ? `Son güncelleme: ${formatLastSync(status.lastSyncedAt)}` : 'Veri güncel';
  }
  // Pending - gösterme
  else if (status.source === 'pending') {
    showIndicator = false;
  }
  else {
    showIndicator = false;
  }

  // fillColor boşsa gösterme
  if (!showIndicator || !fillColor) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "absolute bottom-0 right-0 cursor-help z-20",
              isAnimating && "animate-pulse",
              className
            )}
            style={{ 
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 0 16px 16px',
              borderColor: `transparent transparent ${fillColor} transparent`,
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
