// MultiQueryBuilder - Çoklu sorgu ve birleştirme yapılandırma

import React, { useState } from 'react';
import { 
  DiaApiQuery, 
  QueryMerge, 
  MultiQueryConfig, 
  MergeType, 
  MERGE_TYPES, 
  DIA_MODULES,
  DiaApiFilter,
  DiaApiSort,
} from '@/lib/widgetBuilderTypes';
import { testDiaApi, DiaApiTestResponse } from '@/lib/diaApiTest';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FilterBuilder } from './FilterBuilder';
import { SortBuilder } from './SortBuilder';
import { ColumnSelector } from './ColumnSelector';
import { 
  Plus, Trash2, Play, Link2, Database, ChevronDown, ChevronRight, 
  Settings2, CheckCircle, XCircle, ArrowDown, GripVertical, Loader2,
  ArrowLeftRight, Merge, ArrowRightLeft, Maximize2, Layers, Copy, Grid3x3
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MultiQueryBuilderProps {
  multiQuery: MultiQueryConfig | null;
  onChange: (config: MultiQueryConfig | null) => void;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Database className={className} />;
  return <Icon className={className} />;
};

// Benzersiz ID oluştur
function generateId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Boş sorgu oluştur
function createEmptyQuery(index: number): DiaApiQuery {
  return {
    id: generateId(),
    name: index === 0 ? 'Ana Sorgu' : `Sorgu ${index + 1}`,
    module: 'scf',
    method: 'carikart_listele',
    parameters: {
      limit: 1000,
    },
  };
}

// Tek sorgu düzenleyici
function QueryEditor({
  query,
  index,
  isPrimary,
  onChange,
  onDelete,
  onTest,
  isTesting,
  canDelete,
}: {
  query: DiaApiQuery;
  index: number;
  isPrimary: boolean;
  onChange: (query: DiaApiQuery) => void;
  onDelete: () => void;
  onTest: () => Promise<void>;
  isTesting: boolean;
  canDelete: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [filters, setFilters] = useState<DiaApiFilter[]>(query.parameters.filters || []);
  const [sorts, setSorts] = useState<DiaApiSort[]>(query.parameters.sorts || []);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(query.parameters.selectedcolumns || []);
  const [manualModuleMode, setManualModuleMode] = useState(false);
  const [manualMethodMode, setManualMethodMode] = useState(false);
  
  const currentModule = DIA_MODULES.find(m => m.id === query.module);
  
  const handleModuleChange = (module: string) => {
    const newModule = DIA_MODULES.find(m => m.id === module);
    onChange({
      ...query,
      module: module as any,
      method: newModule?.methods[0] || '',
    });
  };
  
  const handleMethodChange = (method: string) => {
    onChange({ ...query, method });
  };
  
  const handleFiltersChange = (newFilters: DiaApiFilter[]) => {
    setFilters(newFilters);
    onChange({
      ...query,
      parameters: { ...query.parameters, filters: newFilters },
    });
  };
  
  const handleSortsChange = (newSorts: DiaApiSort[]) => {
    setSorts(newSorts);
    onChange({
      ...query,
      parameters: { ...query.parameters, sorts: newSorts },
    });
  };
  
  const handleColumnsChange = (newColumns: string[]) => {
    setSelectedColumns(newColumns);
    onChange({
      ...query,
      parameters: { ...query.parameters, selectedcolumns: newColumns },
    });
  };
  
  return (
    <Card className={cn('overflow-hidden', isPrimary && 'border-primary/50 bg-primary/5')}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <Badge variant={isPrimary ? 'default' : 'secondary'} className="text-xs">
                {isPrimary ? 'Ana' : index + 1}
              </Badge>
              <Input
                value={query.name}
                onChange={(e) => onChange({ ...query, name: e.target.value })}
                className="h-7 w-[150px] text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {query.module}/{query.method}
              </Badge>
              {query.testResult?.sampleFields && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {query.testResult.sampleFields.length} alan
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onTest}
                disabled={isTesting}
                className="h-7 px-2"
              >
                {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              {canDelete && (
                <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-1 pb-3 px-3 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Modül</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-2 text-[10px]"
                    onClick={() => setManualModuleMode(!manualModuleMode)}
                  >
                    {manualModuleMode ? 'Liste' : 'Manuel'}
                  </Button>
                </div>
                {manualModuleMode ? (
                  <Input
                    value={query.module}
                    onChange={(e) => onChange({ ...query, module: e.target.value as any })}
                    className="h-8 text-sm"
                    placeholder="Örn: scf, bcs, fat..."
                  />
                ) : (
                  <Select value={query.module} onValueChange={handleModuleChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIA_MODULES.map(mod => (
                        <SelectItem key={mod.id} value={mod.id}>
                          {mod.name} ({mod.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Metod</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-2 text-[10px]"
                    onClick={() => setManualMethodMode(!manualMethodMode)}
                  >
                    {manualMethodMode ? 'Liste' : 'Manuel'}
                  </Button>
                </div>
                {manualMethodMode ? (
                  <Input
                    value={query.method}
                    onChange={(e) => handleMethodChange(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Örn: carikart_listele..."
                  />
                ) : (
                  <Select value={query.method} onValueChange={handleMethodChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentModule?.methods.map(method => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            {/* Kolon Seçici */}
            <ColumnSelector
              availableFields={query.testResult?.sampleFields || []}
              selectedColumns={selectedColumns}
              onChange={handleColumnsChange}
              fieldTypes={query.testResult?.fieldTypes}
            />
            
            {/* Filtreler */}
            <FilterBuilder
              filters={filters}
              onChange={handleFiltersChange}
              availableFields={query.testResult?.sampleFields || []}
              fieldTypes={query.testResult?.fieldTypes}
            />
            
            {/* Sıralama */}
            <SortBuilder
              sorts={sorts}
              onChange={handleSortsChange}
              availableFields={query.testResult?.sampleFields || []}
            />
            
            <div className="space-y-2">
              <Label className="text-xs">Limit (0 = limitsiz)</Label>
              <Input
                type="number"
                value={query.parameters.limit || 0}
                onChange={(e) => onChange({
                  ...query,
                  parameters: { ...query.parameters, limit: parseInt(e.target.value) || 0 }
                })}
                className="h-8 text-sm w-[120px]"
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Birleştirme düzenleyici
function MergeEditor({
  merge,
  queries,
  onChange,
  onDelete,
}: {
  merge: QueryMerge;
  queries: DiaApiQuery[];
  onChange: (merge: QueryMerge) => void;
  onDelete: () => void;
}) {
  const leftQuery = queries.find(q => q.id === merge.leftQueryId);
  const rightQuery = queries.find(q => q.id === merge.rightQueryId);
  
  const leftFields = leftQuery?.testResult?.sampleFields || [];
  const rightFields = rightQuery?.testResult?.sampleFields || [];
  
  const mergeTypeInfo = MERGE_TYPES.find(m => m.id === merge.mergeType);
  const isUnion = merge.mergeType === 'union' || merge.mergeType === 'union_all';
  
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
      <div className="flex-shrink-0">
        <DynamicIcon iconName={mergeTypeInfo?.icon || 'Link2'} className="h-5 w-5 text-primary" />
      </div>
      
      <div className="flex-1 grid grid-cols-5 gap-2 items-center">
        {/* Sol Sorgu */}
        <Select value={merge.leftQueryId} onValueChange={(v) => onChange({ ...merge, leftQueryId: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Sol sorgu" />
          </SelectTrigger>
          <SelectContent>
            {queries.map(q => (
              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Sol Alan */}
        {!isUnion && (
          <Select value={merge.leftField} onValueChange={(v) => onChange({ ...merge, leftField: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Alan" />
            </SelectTrigger>
            <SelectContent>
              {leftFields.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Birleştirme Tipi */}
        <Select value={merge.mergeType} onValueChange={(v: MergeType) => onChange({ ...merge, mergeType: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MERGE_TYPES.map(type => (
              <SelectItem key={type.id} value={type.id}>
                <div className="flex items-center gap-2">
                  <DynamicIcon iconName={type.icon} className="h-3.5 w-3.5" />
                  {type.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Sağ Alan */}
        {!isUnion && (
          <Select value={merge.rightField} onValueChange={(v) => onChange({ ...merge, rightField: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Alan" />
            </SelectTrigger>
            <SelectContent>
              {rightFields.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Sağ Sorgu */}
        <Select value={merge.rightQueryId} onValueChange={(v) => onChange({ ...merge, rightQueryId: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Sağ sorgu" />
          </SelectTrigger>
          <SelectContent>
            {queries.filter(q => q.id !== merge.leftQueryId).map(q => (
              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function MultiQueryBuilder({ multiQuery, onChange }: MultiQueryBuilderProps) {
  const [testingQueryId, setTestingQueryId] = useState<string | null>(null);
  
  // Çoklu sorgu modunu aktifleştir
  const enableMultiQuery = () => {
    onChange({
      queries: [createEmptyQuery(0)],
      merges: [],
      primaryQueryId: '',
    });
  };
  
  // Çoklu sorgu modunu devre dışı bırak
  const disableMultiQuery = () => {
    onChange(null);
  };
  
  // Sorgu ekle
  const addQuery = () => {
    if (!multiQuery) return;
    const newQuery = createEmptyQuery(multiQuery.queries.length);
    onChange({
      ...multiQuery,
      queries: [...multiQuery.queries, newQuery],
      primaryQueryId: multiQuery.primaryQueryId || newQuery.id,
    });
  };
  
  // Sorgu güncelle
  const updateQuery = (index: number, updatedQuery: DiaApiQuery) => {
    if (!multiQuery) return;
    const newQueries = [...multiQuery.queries];
    newQueries[index] = updatedQuery;
    onChange({ ...multiQuery, queries: newQueries });
  };
  
  // Sorgu sil
  const deleteQuery = (index: number) => {
    if (!multiQuery || multiQuery.queries.length <= 1) return;
    const deletedId = multiQuery.queries[index].id;
    const newQueries = multiQuery.queries.filter((_, i) => i !== index);
    const newMerges = multiQuery.merges.filter(m => m.leftQueryId !== deletedId && m.rightQueryId !== deletedId);
    onChange({
      ...multiQuery,
      queries: newQueries,
      merges: newMerges,
      primaryQueryId: multiQuery.primaryQueryId === deletedId ? newQueries[0]?.id : multiQuery.primaryQueryId,
    });
  };
  
  // Sorgu test et
  const testQuery = async (query: DiaApiQuery, index: number) => {
    setTestingQueryId(query.id);
    try {
      const result = await testDiaApi({
        module: query.module,
        method: query.method,
        limit: query.parameters.limit || 0,
        filters: query.parameters.filters,
        selectedColumns: query.parameters.selectedcolumns,
        sorts: query.parameters.sorts,
      });
      
      if (result.success) {
        const updatedQuery = {
          ...query,
          testResult: {
            sampleFields: result.sampleFields || [],
            fieldTypes: result.fieldTypes || {},
          },
        };
        updateQuery(index, updatedQuery);
        toast.success(`"${query.name}" testi başarılı: ${result.recordCount} kayıt`);
      } else {
        toast.error(`API hatası: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Test hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setTestingQueryId(null);
    }
  };
  
  // Birleştirme ekle
  const addMerge = () => {
    if (!multiQuery || multiQuery.queries.length < 2) {
      toast.error('Birleştirme için en az 2 sorgu gerekli');
      return;
    }
    const newMerge: QueryMerge = {
      leftQueryId: multiQuery.queries[0].id,
      leftField: '_key',
      rightQueryId: multiQuery.queries[1].id,
      rightField: '_key',
      mergeType: 'left_join',
    };
    onChange({
      ...multiQuery,
      merges: [...multiQuery.merges, newMerge],
    });
  };
  
  // Birleştirme güncelle
  const updateMerge = (index: number, updatedMerge: QueryMerge) => {
    if (!multiQuery) return;
    const newMerges = [...multiQuery.merges];
    newMerges[index] = updatedMerge;
    onChange({ ...multiQuery, merges: newMerges });
  };
  
  // Birleştirme sil
  const deleteMerge = (index: number) => {
    if (!multiQuery) return;
    onChange({
      ...multiQuery,
      merges: multiQuery.merges.filter((_, i) => i !== index),
    });
  };
  
  // Çoklu sorgu modu aktif değilse
  if (!multiQuery) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Çoklu Veri Kaynağı
          </CardTitle>
          <CardDescription>
            Birden fazla DIA web servisinden veri çekip birleştirin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Database className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-4">
              Birden fazla tabloyu birleştirmek için çoklu sorgu modunu aktifleştirin
            </p>
            <Button onClick={enableMultiQuery}>
              <Plus className="h-4 w-4 mr-2" />
              Çoklu Sorgu Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Birleştirilmiş alanları hesapla
  const allFields = new Set<string>();
  multiQuery.queries.forEach(q => {
    q.testResult?.sampleFields?.forEach(f => allFields.add(f));
  });
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Çoklu Veri Kaynağı
              <Badge variant="secondary" className="text-xs">{multiQuery.queries.length} sorgu</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Sorgular sırayla çalıştırılır ve birleştirilir
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addQuery} disabled={multiQuery.queries.length >= 5} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Sorgu Ekle
            </Button>
            <Button size="sm" variant="ghost" onClick={disableMultiQuery} className="h-7 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />
              Kaldır
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {/* Sorgular - Kompakt scroll alanı */}
        <div className="border rounded-md">
          <div className="p-2 bg-muted/30 border-b">
            <Label className="text-xs font-medium">Sorgular</Label>
          </div>
          <ScrollArea className="h-[280px]">
            <div className="p-2 space-y-2">
              {multiQuery.queries.map((query, index) => (
                <div key={query.id}>
                  <QueryEditor
                    query={query}
                    index={index}
                    isPrimary={multiQuery.primaryQueryId === query.id || (index === 0 && !multiQuery.primaryQueryId)}
                    onChange={(q) => updateQuery(index, q)}
                    onDelete={() => deleteQuery(index)}
                    onTest={() => testQuery(query, index)}
                    isTesting={testingQueryId === query.id}
                    canDelete={multiQuery.queries.length > 1}
                  />
                  {index < multiQuery.queries.length - 1 && (
                    <div className="flex justify-center my-1">
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        {/* Birleştirmeler - Ayrı scroll alanı */}
        {multiQuery.queries.length >= 2 && (
          <div className="border rounded-md">
            <div className="p-2 bg-muted/30 border-b flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Link2 className="h-3 w-3" />
                Birleştirmeler
              </Label>
              <Button size="sm" variant="ghost" onClick={addMerge} className="h-6 text-xs px-2">
                <Plus className="h-3 w-3 mr-1" />
                Ekle
              </Button>
            </div>
            <ScrollArea className="h-[200px]">
              {multiQuery.merges.length > 0 ? (
                <div className="p-2 space-y-1.5">
                  {multiQuery.merges.map((merge, index) => (
                    <MergeEditor
                      key={index}
                      merge={merge}
                      queries={multiQuery.queries}
                      onChange={(m) => updateMerge(index, m)}
                      onDelete={() => deleteMerge(index)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  <Link2 className="h-5 w-5 mx-auto mb-1 opacity-30" />
                  <p>Sorgular arasında bağlantı yok</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
        
        {/* Birleştirilmiş Alanlar Önizleme */}
        {allFields.size > 0 && (
          <div className="border rounded-md p-2">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Birleştirilmiş Alanlar</Label>
            <div className="flex flex-wrap gap-1">
              {Array.from(allFields).slice(0, 15).map(field => (
                <Badge key={field} variant="outline" className="text-[10px] py-0">
                  {field}
                </Badge>
              ))}
              {allFields.size > 15 && (
                <Badge variant="secondary" className="text-[10px] py-0">
                  +{allFields.size - 15} daha
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}