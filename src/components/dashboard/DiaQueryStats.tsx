// DiaQueryStats - DIA sorgu istatistiklerini ve cache durumunu gösterir

import React, { useState } from 'react';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useDataSources } from '@/hooks/useDataSources';
import { Database, Zap, TrendingUp, Clock, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Trash2, Eye, Table as TableIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface PreviewSource {
  id: string;
  name: string;
  module: string;
  method: string;
  syncTime: Date | null;
}

export function DiaQueryStats({ customTrigger }: { customTrigger?: React.ReactNode } = {}) {
  const { 
    stats, 
    getFetchedDataSources, 
    clearFetchedRegistry, 
    resetStats, 
    invalidateCache, 
    getDataSourceData,
    getAllDataSourceSyncTimes,
  } = useDiaDataCache();
  const { dataSources } = useDataSources();
  const [isOpen, setIsOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fetchedIds = getFetchedDataSources();
  const syncTimes = getAllDataSourceSyncTimes();
  
  // Hiç sorgu yapılmadıysa ve customTrigger yoksa gösterme
  if (!customTrigger && stats.totalQueries === 0 && fetchedIds.length === 0) return null;
  
  const savingsPercent = stats.totalQueries > 0 
    ? Math.round((stats.cacheHits / stats.totalQueries) * 100) 
    : 0;

  // Veri kaynağı ID'lerini isimlere çevir ve sync zamanlarını ekle
  const fetchedSources: PreviewSource[] = fetchedIds.map(id => {
    const ds = dataSources.find(d => d.id === id);
    return {
      id,
      name: ds?.name || id.slice(0, 8) + '...',
      module: ds?.module || '-',
      method: ds?.method || '-',
      syncTime: syncTimes.get(id) || null,
    };
  });

  // Relative time formatla (Türkçe)
  const formatSyncTime = (date: Date | null): string => {
    if (!date) return 'Bilinmiyor';
    return formatDistanceToNow(date, { addSuffix: true, locale: tr });
  };

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

  // Önizleme verisi
  const previewData = previewSource ? (getDataSourceData(previewSource.id) || []) : [];
  
  // Kolon başlıklarını al
  const columns = previewData.length > 0 ? Object.keys(previewData[0]) : [];
  
  // Arama filtresi
  const filteredData = previewData.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Kolon adını formatla
  const formatColumnName = (col: string) => {
    return col
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Hücre değerini formatla
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('tr-TR');
    }
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
    return String(value);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {customTrigger || (
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
          )}
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
              <ScrollArea className="h-40">
                <div className="space-y-1">
                  {fetchedSources.map((source) => (
                    <div 
                      key={source.id}
                      className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{source.name}</div>
                        <div className="text-muted-foreground text-[10px]">
                          {source.module}/{source.method}
                        </div>
                        {/* YENİ: Son sync zamanı */}
                        <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatSyncTime(source.syncTime)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setPreviewSource(source);
                          setSearchTerm('');
                          setIsOpen(false);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
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

      {/* Veri Önizleme Sheet */}
      <Sheet open={!!previewSource} onOpenChange={(open) => !open && setPreviewSource(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4" />
                  {previewSource?.name}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {previewSource?.module}/{previewSource?.method} • {previewData.length} kayıt
                </p>
              </div>
            </div>
          </SheetHeader>
          
          {/* Arama */}
          <div className="p-4 border-b flex-shrink-0">
            <Input
              placeholder="Tabloda ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
            {searchTerm && (
              <p className="text-xs text-muted-foreground mt-2">
                {filteredData.length} / {previewData.length} kayıt gösteriliyor
              </p>
            )}
          </div>
          
          {/* Tablo */}
          <div className="flex-1 overflow-hidden">
            {previewData.length > 0 ? (
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-10 text-center text-xs">#</TableHead>
                          {columns.slice(0, 8).map((col) => (
                            <TableHead key={col} className="text-xs whitespace-nowrap">
                              {formatColumnName(col)}
                            </TableHead>
                          ))}
                          {columns.length > 8 && (
                            <TableHead className="text-xs text-muted-foreground">
                              +{columns.length - 8} kolon
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.slice(0, 100).map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            {columns.slice(0, 8).map((col) => (
                              <TableCell key={col} className="text-xs max-w-48 truncate">
                                {formatCellValue((row as Record<string, unknown>)[col])}
                              </TableCell>
                            ))}
                            {columns.length > 8 && (
                              <TableCell className="text-xs text-muted-foreground">...</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {filteredData.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      İlk 100 kayıt gösteriliyor. Toplam: {filteredData.length}
                    </p>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Database className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Bu veri kaynağında veri bulunamadı</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t flex-shrink-0 bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{columns.length} kolon</span>
              <span>{previewData.length} toplam kayıt</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}