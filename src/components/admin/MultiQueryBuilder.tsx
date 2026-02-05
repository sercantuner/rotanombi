// MultiQueryBuilder - Çoklu sorgu yapılandırma (Basitleştirilmiş)
// Veri Kaynağı (Data Source) seçimi ile çalışır - Birleştirme işlemleri AI tarafından otomatik yapılır

import React, { useState, useMemo } from 'react';
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
import { useDataSources, DataSource } from '@/hooks/useDataSources';
import { useDataSourceRelationships } from '@/hooks/useDataSourceRelationships';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, Trash2, Link2, Database, ChevronDown, ChevronRight, 
  CheckCircle, ArrowDown, GripVertical,
  ArrowLeftRight, Merge, ArrowRightLeft, Maximize2, Layers, Copy, Grid3x3, Share2, Info, Sparkles
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CompactSearchableFieldSelect } from './SearchableFieldSelect';
import { MergeResultVisualization } from './MergeResultVisualization';

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

// Tek sorgu düzenleyici - Veri kaynağı seçimi ile çalışır
function QueryEditor({
  query,
  index,
  isPrimary,
  onChange,
  onDelete,
  canDelete,
  dataSources,
}: {
  query: DiaApiQuery;
  index: number;
  isPrimary: boolean;
  onChange: (query: DiaApiQuery) => void;
  onDelete: () => void;
  canDelete: boolean;
  dataSources: DataSource[];
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [manualModuleMode, setManualModuleMode] = useState(false);
  const [manualMethodMode, setManualMethodMode] = useState(false);
  
  const currentModule = DIA_MODULES.find(m => m.id === query.module);
  
  // Veri kaynağı seçildiğinde sorgu parametrelerini güncelle
  const handleDataSourceSelect = (dataSourceId: string) => {
    if (dataSourceId === 'none') {
      // Veri kaynağı kaldırıldı - manuel moda geç
      onChange({
        ...query,
        dataSourceId: undefined,
        dataSourceName: undefined,
        testResult: undefined,
      });
      return;
    }
    
    const source = dataSources.find(ds => ds.id === dataSourceId);
    if (source) {
      onChange({
        ...query,
        dataSourceId: source.id,
        dataSourceName: source.name,
        module: source.module as any,
        method: source.method,
        parameters: {
          filters: source.filters as DiaApiFilter[] || [],
          sorts: source.sorts as DiaApiSort[] || [],
          selectedcolumns: source.selected_columns || [],
          limit: source.limit_count || 1000,
        },
        testResult: {
          sampleFields: source.last_fields as string[] || [],
          fieldTypes: {},
        },
      });
    }
  };
  
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
              {query.dataSourceId ? (
                <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">
                  <Share2 className="h-3 w-3 mr-1" />
                  {query.dataSourceName || 'Veri Kaynağı'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {query.module}/{query.method}
                </Badge>
              )}
              {query.testResult?.sampleFields && query.testResult.sampleFields.length > 0 && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {query.testResult.sampleFields.length} alan
                </Badge>
              )}
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
            {/* Veri Kaynağı Seçimi */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-2">
                <Database className="h-3 w-3" />
                Veri Kaynağı
              </Label>
              <Select 
                value={query.dataSourceId || 'none'} 
                onValueChange={handleDataSourceSelect}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Veri kaynağı seçin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Manuel Yapılandırma --</SelectItem>
                  {dataSources.map(source => (
                    <SelectItem key={source.id} value={source.id}>
                      <div className="flex items-center gap-2">
                        {source.is_shared && <Share2 className="h-3 w-3 text-blue-500" />}
                        <span>{source.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({source.module}/{source.method})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Veri kaynağı seçilmemişse manuel modül/metod seçimi */}
            {!query.dataSourceId && (
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
            )}
            
            {/* Alan sayısı bilgisi - kompakt */}
            {query.testResult?.sampleFields && query.testResult.sampleFields.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {query.testResult.sampleFields.length} alan
                </Badge>
              </div>
            )}

            {/* Limit */}
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
        
        {/* Sol Alan - Aranabilir */}
        {!isUnion && (
          <CompactSearchableFieldSelect
            value={merge.leftField}
            onValueChange={(v) => onChange({ ...merge, leftField: v === '__none__' ? '' : v })}
            fields={leftFields}
            placeholder="Alan"
            className="h-8"
          />
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
        
        {/* Sağ Alan - Aranabilir */}
        {!isUnion && (
          <CompactSearchableFieldSelect
            value={merge.rightField}
            onValueChange={(v) => onChange({ ...merge, rightField: v === '__none__' ? '' : v })}
            fields={rightFields}
            placeholder="Alan"
            className="h-8"
          />
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
  // Veri kaynaklarını ve ilişkileri hook ile çek
  const { activeDataSources, isLoading: isLoadingDataSources, getDataSourceById } = useDataSources();
  const { getRelationshipsForDataSource, getRelationshipsBetween } = useDataSourceRelationships();
  
  // Gelişmiş mod (birleştirme paneli göster/gizle)
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);
  
  // Seçili veri kaynaklarının otomatik ilişkilerini hesapla
  const autoDetectedRelationships = useMemo(() => {
    if (!multiQuery?.queries || multiQuery.queries.length < 2) return [];
    
    const detected: { source: string; target: string; sourceField: string; targetField: string; type: string }[] = [];
    
    for (let i = 0; i < multiQuery.queries.length; i++) {
      for (let j = i + 1; j < multiQuery.queries.length; j++) {
        const sourceId = multiQuery.queries[i].dataSourceId;
        const targetId = multiQuery.queries[j].dataSourceId;
        
        if (sourceId && targetId) {
          const rels = getRelationshipsBetween(sourceId, targetId);
          rels.forEach(rel => {
            const sourceName = getDataSourceById(rel.source_data_source_id)?.name || '';
            const targetName = getDataSourceById(rel.target_data_source_id)?.name || '';
            detected.push({
              source: sourceName,
              target: targetName,
              sourceField: rel.source_field,
              targetField: rel.target_field,
              type: rel.relationship_type
            });
          });
        }
      }
    }
    
    return detected;
  }, [multiQuery?.queries, getRelationshipsBetween, getDataSourceById]);
  
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
            Birden fazla veri kaynağını birleştirin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Database className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-4">
              Birden fazla veri kaynağını birleştirmek için çoklu sorgu modunu aktifleştirin
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
              Her sorgu için mevcut bir veri kaynağı seçin
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
            <Label className="text-xs font-medium">Sorgular ({activeDataSources?.length || 0} kaynak mevcut)</Label>
          </div>
          <ScrollArea className="h-[350px]">
            <div className="p-2 space-y-2">
              {multiQuery.queries.map((query, index) => (
                <div key={query.id}>
                  <QueryEditor
                    query={query}
                    index={index}
                    isPrimary={multiQuery.primaryQueryId === query.id || (index === 0 && !multiQuery.primaryQueryId)}
                    onChange={(q) => updateQuery(index, q)}
                    onDelete={() => deleteQuery(index)}
                    canDelete={multiQuery.queries.length > 1}
                    dataSources={activeDataSources || []}
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
        
        {/* Otomatik İlişki Bilgisi - Veri Modeli'nden */}
        {autoDetectedRelationships.length > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Otomatik Tespit Edilen İlişkiler</span>
            </div>
            <div className="space-y-1">
              {autoDetectedRelationships.map((rel, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{rel.source}</Badge>
                  <span className="text-primary">→</span>
                  <span className="font-mono text-[10px]">{rel.sourceField} = {rel.targetField}</span>
                  <span className="text-primary">→</span>
                  <Badge variant="outline" className="text-[10px]">{rel.target}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{rel.type}</Badge>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Bu ilişkiler Veri Modeli'nden alınır ve AI kod üretiminde otomatik kullanılır.
            </p>
          </div>
        )}
        
        {/* Gelişmiş Mod - Manuel Birleştirme (Opsiyonel) */}
        {multiQuery.queries.length >= 2 && (
          <Collapsible open={showAdvancedMode} onOpenChange={setShowAdvancedMode}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs">
                <span className="flex items-center gap-2">
                  <Link2 className="h-3 w-3" />
                  Gelişmiş: Manuel Birleştirme
                </span>
                {showAdvancedMode ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="text-center py-3 text-xs text-muted-foreground border rounded-md">
                <p>Manuel birleştirme genellikle gerekli değildir.</p>
                <p className="mt-1">AI, Veri Modeli ilişkilerini otomatik kullanır.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}