// MergeResultVisualization - Birleştirme sonucu görselleştirmesi
// Sorgu birleştirme işlemlerini görsel diyagram olarak gösterir

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Database, ArrowRight, Merge, Plus, Equal, 
  ArrowLeftRight, Layers, CheckCircle, Info
} from 'lucide-react';
import { DiaApiQuery, QueryMerge, MultiQueryConfig, MERGE_TYPES } from '@/lib/widgetBuilderTypes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MergeResultVisualizationProps {
  queries: DiaApiQuery[];
  merges: QueryMerge[];
  mergedData?: Record<string, any[]>;
  className?: string;
}

// Birleştirme tipi için renk
const getMergeTypeColor = (type: string): string => {
  switch (type) {
    case 'left_join': return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
    case 'inner_join': return 'text-green-500 border-green-500/30 bg-green-500/10';
    case 'outer_join': return 'text-purple-500 border-purple-500/30 bg-purple-500/10';
    case 'union': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    case 'union_all': return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    case 'cross_join': return 'text-red-500 border-red-500/30 bg-red-500/10';
    default: return 'text-muted-foreground';
  }
};

// Sorgu kartı bileşeni
function QueryCard({ 
  query, 
  recordCount, 
  isPrimary 
}: { 
  query: DiaApiQuery; 
  recordCount?: number;
  isPrimary?: boolean;
}) {
  const fields = query.testResult?.sampleFields || [];
  
  return (
    <div className={cn(
      "flex flex-col items-center p-3 rounded-lg border-2 min-w-[140px] transition-all",
      isPrimary 
        ? "border-primary bg-primary/5" 
        : "border-border bg-muted/30"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Database className={cn("h-4 w-4", isPrimary ? "text-primary" : "text-muted-foreground")} />
        <span className="font-medium text-sm">{query.name}</span>
      </div>
      
      <div className="text-xs text-muted-foreground space-y-0.5 text-center">
        <div>{fields.length} alan</div>
        {recordCount !== undefined && (
          <div className="font-medium text-foreground">{recordCount.toLocaleString('tr-TR')} kayıt</div>
        )}
      </div>
      
      {query.dataSourceName && (
        <Badge variant="secondary" className="mt-2 text-[10px]">
          {query.dataSourceName}
        </Badge>
      )}
    </div>
  );
}

// Birleştirme operatörü bileşeni
function MergeOperator({ merge }: { merge: QueryMerge }) {
  const mergeType = MERGE_TYPES.find(m => m.id === merge.mergeType);
  const colorClass = getMergeTypeColor(merge.mergeType);
  const isUnion = merge.mergeType === 'union' || merge.mergeType === 'union_all';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-full border-2",
              colorClass
            )}>
              {isUnion ? (
                <Layers className="h-5 w-5" />
              ) : (
                <Merge className="h-5 w-5" />
              )}
            </div>
            <span className="text-[10px] font-medium uppercase">
              {mergeType?.name || merge.mergeType}
            </span>
            {!isUnion && merge.leftField && merge.rightField && (
              <div className="text-[9px] text-muted-foreground text-center max-w-[80px]">
                <span className="block truncate">{merge.leftField}</span>
                <ArrowLeftRight className="h-2.5 w-2.5 mx-auto my-0.5" />
                <span className="block truncate">{merge.rightField}</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{mergeType?.name}</p>
          <p className="text-xs text-muted-foreground">{mergeType?.description}</p>
          {!isUnion && (
            <p className="text-xs mt-1">
              Birleşim: {merge.leftField} ↔ {merge.rightField}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MergeResultVisualization({
  queries,
  merges,
  mergedData,
  className,
}: MergeResultVisualizationProps) {
  if (!queries || queries.length === 0) {
    return null;
  }

  // Toplam alan sayısını hesapla (tüm sorgulardan)
  const allFields = new Set<string>();
  queries.forEach(q => {
    (q.testResult?.sampleFields || []).forEach(f => allFields.add(f));
  });

  // Tahmini kayıt sayısı (birleştirme tipine bağlı)
  const calculateEstimatedRecords = () => {
    if (!mergedData) return null;
    
    const primaryQuery = queries[0];
    if (!primaryQuery) return null;
    
    const primaryData = mergedData[primaryQuery.id];
    if (!primaryData) return null;
    
    return primaryData.length;
  };

  const estimatedRecords = calculateEstimatedRecords();

  // Birleştirme yoksa sadece sorguları göster
  if (merges.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Veri Kaynakları
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {queries.map((query, index) => (
              <QueryCard 
                key={query.id} 
                query={query} 
                recordCount={mergedData?.[query.id]?.length}
                isPrimary={index === 0}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Merge className="h-4 w-4" />
          Birleştirme Sonucu
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Görsel Diyagram */}
        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
          {merges.map((merge, index) => {
            const leftQuery = queries.find(q => q.id === merge.leftQueryId);
            const rightQuery = queries.find(q => q.id === merge.rightQueryId);
            
            if (!leftQuery || !rightQuery) return null;
            
            return (
              <React.Fragment key={`merge-${index}`}>
                {index === 0 && (
                  <QueryCard 
                    query={leftQuery} 
                    recordCount={mergedData?.[leftQuery.id]?.length}
                    isPrimary={true}
                  />
                )}
                
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <MergeOperator merge={merge} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <QueryCard 
                  query={rightQuery} 
                  recordCount={mergedData?.[rightQuery.id]?.length}
                />
              </React.Fragment>
            );
          })}
          
          {/* Sonuç kartı */}
          <div className="flex items-center gap-2">
            <Equal className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex flex-col items-center p-3 rounded-lg border-2 border-green-500/50 bg-green-500/10 min-w-[160px]">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-sm text-green-700 dark:text-green-400">Zenginleştirilmiş Veri</span>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-0.5 text-center">
              <div className="font-medium text-foreground">{allFields.size} alan</div>
              {estimatedRecords !== null && (
                <div>~{estimatedRecords.toLocaleString('tr-TR')} kayıt</div>
              )}
            </div>
          </div>
        </div>

        {/* Sonuç Alanları */}
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Sonuç Alanları:</span>
          </div>
          
          <ScrollArea className="max-h-[80px]">
            <div className="flex flex-wrap gap-1">
              {Array.from(allFields).sort((a, b) => a.localeCompare(b, 'tr')).map(field => (
                <Badge key={field} variant="outline" className="text-[10px] py-0">
                  {field}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
