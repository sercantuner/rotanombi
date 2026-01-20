// DiaQueryStats - DIA sorgu istatistiklerini ve cache durumunu gösterir

import React, { useState } from 'react';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useDataSources } from '@/hooks/useDataSources';
import { Database, Zap, TrendingUp, Clock, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DiaQueryStats() {
  const { stats, getFetchedDataSources, clearFetchedRegistry, resetStats, invalidateCache } = useDiaDataCache();
  const { dataSources } = useDataSources();
  const [isOpen, setIsOpen] = useState(false);
  
  const fetchedIds = getFetchedDataSources();
  
  // Hiç sorgu yapılmadıysa gösterme
  if (stats.totalQueries === 0 && fetchedIds.length === 0) return null;
  
  const savingsPercent = stats.totalQueries > 0 
    ? Math.round((stats.cacheHits / stats.totalQueries) * 100) 
    : 0;

  // Veri kaynağı ID'lerini isimlere çevir
  const fetchedSources = fetchedIds.map(id => {
    const ds = dataSources.find(d => d.id === id);
    return {
      id,
      name: ds?.name || id.slice(0, 8) + '...',
      module: ds?.module || '-',
      method: ds?.method || '-',
    };
  });

  // Son API çağrısı zamanını formatla
  const formatLastApiTime = () => {
    if (!stats.lastApiCallTime) return 'Henüz API çağrısı yok';
    const diff = Math.round((Date.now() - stats.lastApiCallTime) / 1000);
    if (diff < 60) return `${diff} saniye önce`;
    if (diff < 3600) return `${Math.round(diff / 60)} dakika önce`;
    return `${Math.round(diff / 3600)} saat önce`;
  };

  // Cache'i temizle
  const handleClearCache = () => {
    clearFetchedRegistry();
    invalidateCache();
    resetStats();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md cursor-pointer hover:bg-muted transition-colors">
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
          
          {isOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">DIA Cache Durumu</h4>
          <p className="text-xs text-muted-foreground">Sorgu istatistikleri ve önbellek</p>
        </div>
        
        {/* İstatistikler */}
        <div className="p-3 grid grid-cols-2 gap-3 border-b">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Toplam Sorgu</div>
            <div className="text-lg font-semibold">{stats.totalQueries}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
              Cache Hit
            </div>
            <div className="text-lg font-semibold text-green-600">{stats.cacheHits}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3 text-red-500" />
              Gerçek API
            </div>
            <div className="text-lg font-semibold text-red-600">{stats.realApiCalls}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Tasarruf</div>
            <div className="text-lg font-semibold text-primary">{savingsPercent}%</div>
          </div>
        </div>
        
        {/* Son API Çağrısı */}
        <div className="px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Son API Çağrısı:
            </span>
            <span className="font-medium">{formatLastApiTime()}</span>
          </div>
        </div>
        
        {/* Yüklenmiş Veri Kaynakları */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Yüklenmiş Veri Kaynakları</span>
            <Badge variant="outline" className="text-[10px]">
              {fetchedSources.length}
            </Badge>
          </div>
          
          {fetchedSources.length > 0 ? (
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {fetchedSources.map((source) => (
                  <div 
                    key={source.id}
                    className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{source.name}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {source.module}/{source.method}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              Henüz veri kaynağı yüklenmedi
            </div>
          )}
        </div>
        
        {/* Temizle Butonu */}
        <div className="p-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs h-8"
            onClick={handleClearCache}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Cache Temizle & Sıfırla
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Sonraki sayfa yüklemesinde tüm veriler yeniden sorgulanır
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}