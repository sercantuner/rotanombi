// DiaQueryStats - DIA sorgu istatistiklerini gösterir

import React from 'react';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { Database, Zap, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function DiaQueryStats() {
  const { stats } = useDiaDataCache();
  
  // Hiç sorgu yapılmadıysa gösterme
  if (stats.totalQueries === 0) return null;
  
  const savingsPercent = stats.totalQueries > 0 
    ? Math.round((stats.cacheHits / stats.totalQueries) * 100) 
    : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md cursor-help">
          <Database className="h-3 w-3" />
          <span>{stats.totalQueries}</span>
          
          {stats.cacheHits > 0 && (
            <>
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">{stats.cacheHits}</span>
            </>
          )}
          
          {savingsPercent > 0 && (
            <Badge variant="secondary" className="h-4 text-[10px] px-1 bg-green-500/20 text-green-700 dark:text-green-400">
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
              {savingsPercent}%
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span>Toplam Sorgu:</span>
            <span className="font-medium">{stats.totalQueries}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Cache Hit:</span>
            <span className="font-medium text-green-600">{stats.cacheHits}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>API Çağrısı:</span>
            <span className="font-medium text-amber-600">{stats.cacheMisses}</span>
          </div>
          {savingsPercent > 0 && (
            <div className="pt-1 border-t text-green-600">
              %{savingsPercent} kontör tasarrufu
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
