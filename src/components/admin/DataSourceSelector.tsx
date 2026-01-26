// DataSourceSelector - Widget Builder'da veri kaynağı seçimi

import React from 'react';
import { useDataSources, DataSource } from '@/hooks/useDataSources';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Database, 
  Clock, 
  RefreshCw, 
  Plus, 
  ExternalLink,
  Info,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface DataSourceSelectorProps {
  selectedId: string | null;
  onSelect: (dataSource: DataSource | null) => void;
  onCreateNew?: () => void;
  showDetails?: boolean;
  hideHeader?: boolean;
  className?: string;
}

export function DataSourceSelector({
  selectedId,
  onSelect,
  onCreateNew,
  showDetails = true,
  hideHeader = false,
  className
}: DataSourceSelectorProps) {
  const { activeDataSources, isLoading, getDataSourceById } = useDataSources();

  const selectedSource = selectedId ? getDataSourceById(selectedId) : null;

  const handleSelect = (value: string) => {
    if (value === '__new__') {
      onCreateNew?.();
      return;
    }
    if (value === '__none__') {
      onSelect(null);
      return;
    }
    const source = getDataSourceById(value);
    onSelect(source || null);
  };

  const formatLastFetch = (date: string | null) => {
    if (!date) return 'Hiç çalışmadı';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Veri Kaynağı</span>
          <Badge variant="outline" className="ml-auto text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Kontör Tasarrufu
          </Badge>
        </div>
      )}

      <Select
        value={selectedId || '__none__'} 
        onValueChange={handleSelect}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Veri kaynağı seçin veya yeni sorgu tanımlayın" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Yeni Sorgu Tanımla</span>
            </div>
          </SelectItem>
          
          {activeDataSources.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                Mevcut Kaynaklar
              </div>
              {activeDataSources.map(source => (
                <SelectItem key={source.id} value={source.id}>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span>{source.name}</span>
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {source.module}.{source.method}
                    </Badge>
                    {source.is_shared && (
                      <Badge variant="outline" className="text-[10px]">
                        Paylaşımlı
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </>
          )}

          {onCreateNew && (
            <>
              <div className="border-t my-1" />
              <SelectItem value="__new__">
                <div className="flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" />
                  <span>Yeni Kaynak Oluştur</span>
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Seçili kaynak detayları - Sadeleştirilmiş */}
      {showDetails && selectedSource && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                {selectedSource.name}
              </h4>
              <Badge variant="outline" className="text-xs">
                {selectedSource.module}.{selectedSource.method}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {Math.floor(selectedSource.cache_ttl / 60)} dk önbellek
              </span>
              {selectedSource.last_record_count !== null && (
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {selectedSource.last_record_count.toLocaleString('tr-TR')} kayıt
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yeni sorgu modu bilgisi */}
      {!selectedId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <Info className="h-3.5 w-3.5" />
          <span>Aşağıda modül ve metod seçerek yeni bir sorgu tanımlayabilirsiniz.</span>
        </div>
      )}
    </div>
  );
}
