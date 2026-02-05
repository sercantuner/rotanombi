// DataTransformEditor - Power Query tarzı veri dönüşüm editörü

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Loader2,
  Filter,
  ArrowUpDown,
  Columns3,
  ChevronRight,
  Check,
  Trash2,
  Plus,
  Settings2,
  Database,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowDown,
  ArrowUp,
  Search,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  Sparkles,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DataSource } from '@/hooks/useDataSources';
import { DiaApiFilter, DiaApiSort, FILTER_OPERATORS, SORT_TYPES } from '@/lib/widgetBuilderTypes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Dönüşüm adımı tipleri
type StepType = 'source' | 'filter' | 'sort' | 'select_columns' | 'rename_column' | 'change_type';

interface TransformStep {
  id: string;
  type: StepType;
  label: string;
  config: any;
  enabled: boolean;
}

interface DataTransformEditorProps {
  dataSource: DataSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataSource: DataSource, updates: Partial<DataSource>) => Promise<void>;
}

// Alan tipi ikonları
const getFieldTypeIcon = (fieldName: string) => {
  const lower = fieldName.toLowerCase();
  if (lower.includes('tarih') || lower.includes('date')) {
    return <Calendar className="w-3.5 h-3.5 text-warning" />;
  }
  if (lower.includes('tutar') || lower.includes('bakiye') || lower.includes('fiyat') || lower.includes('miktar')) {
    return <Hash className="w-3.5 h-3.5 text-primary" />;
  }
  if (lower.includes('kod') || lower.includes('_key') || lower === 'id') {
    return <Database className="w-3.5 h-3.5 text-warning" />;
  }
  if (lower.includes('aktif') || lower.includes('durum') || lower.includes('pasif')) {
    return <ToggleLeft className="w-3.5 h-3.5 text-accent-foreground" />;
  }
  return <Type className="w-3.5 h-3.5 text-muted-foreground" />;
};

// Operatör etiketleri
const getOperatorLabel = (op: string) => {
  const found = FILTER_OPERATORS.find(o => o.id === op);
  return found?.name || op;
};

export function DataTransformEditor({
  dataSource,
  open,
  onOpenChange,
  onSave,
}: DataTransformEditorProps) {
  // State
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dönüşüm ayarları (lokal state)
  const [filters, setFilters] = useState<DiaApiFilter[]>([]);
  const [sorts, setSorts] = useState<DiaApiSort[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [limitCount, setLimitCount] = useState(100);

  // UI state
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Alan listesi
  const allFields = useMemo(() => dataSource?.last_fields || [], [dataSource]);

  const filteredFields = useMemo(() => {
    let fields = allFields;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      fields = fields.filter(f => f.toLowerCase().includes(term));
    }
    if (showOnlySelected && selectedColumns.length > 0) {
      fields = fields.filter(f => selectedColumns.includes(f));
    }
    return fields;
  }, [allFields, searchTerm, showOnlySelected, selectedColumns]);

  // DataSource değiştiğinde state'i yükle
  useEffect(() => {
    if (dataSource) {
      setFilters(dataSource.filters || []);
      setSorts(dataSource.sorts || []);
      setSelectedColumns(dataSource.selected_columns || []);
      setLimitCount(dataSource.limit_count || 100);
      setExpandedStep(null);
      setError(null);
    }
  }, [dataSource]);

  // Uygulanan adımları oluştur
  const steps = useMemo<TransformStep[]>(() => {
    const result: TransformStep[] = [
      {
        id: 'source',
        type: 'source',
        label: 'Kaynak',
        config: { module: dataSource?.module, method: dataSource?.method },
        enabled: true,
      },
    ];

    // Sütun seçimi
    if (selectedColumns.length > 0 && selectedColumns.length < allFields.length) {
      result.push({
        id: 'columns',
        type: 'select_columns',
        label: `Sütunlar Seçildi (${selectedColumns.length})`,
        config: { columns: selectedColumns },
        enabled: true,
      });
    }

    // Filtreler
    filters.forEach((filter, idx) => {
      result.push({
        id: `filter_${idx}`,
        type: 'filter',
        label: `Filtre: ${filter.field} ${getOperatorLabel(filter.operator || '=')} "${filter.value}"`,
        config: filter,
        enabled: true,
      });
    });

    // Sıralamalar
    sorts.forEach((sort, idx) => {
      result.push({
        id: `sort_${idx}`,
        type: 'sort',
        label: `Sırala: ${sort.field} (${sort.sorttype === 'ASC' ? 'Artan' : 'Azalan'})`,
        config: sort,
        enabled: true,
      });
    });

    return result;
  }, [dataSource, selectedColumns, filters, sorts, allFields.length]);

  // Veri önizleme
  const loadPreview = useCallback(async () => {
    if (!dataSource) return;

    setIsLoading(true);
    setError(null);

    try {
      // Supabase session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Oturum bulunamadı');

      const payload = {
        module: dataSource.module,
        method: dataSource.method,
        filters: filters.length > 0 ? filters : undefined,
        sorts: sorts.length > 0 ? sorts : undefined,
        selectedcolumns: selectedColumns.length > 0 ? selectedColumns : undefined,
        limit: Math.min(limitCount, 50), // Preview için max 50
      };

      const { data, error: fnError } = await supabase.functions.invoke('dia-api-test', {
        body: payload,
      });

      if (fnError) throw fnError;

      if (data?.success && data?.data) {
        const records = Array.isArray(data.data) ? data.data : [data.data];
        setPreviewData(records.slice(0, 50));
      } else {
        throw new Error(data?.error || 'Veri alınamadı');
      }
    } catch (err: any) {
      console.error('Preview error:', err);
      setError(err.message || 'Veri yüklenirken hata oluştu');
      setPreviewData([]);
    } finally {
      setIsLoading(false);
    }
  }, [dataSource, filters, sorts, selectedColumns, limitCount]);

  // İlk açılışta önizleme yükle
  useEffect(() => {
    if (open && dataSource) {
      loadPreview();
    }
  }, [open, dataSource?.id]);

  // Kaydet
  const handleSave = async () => {
    if (!dataSource) return;

    setIsSaving(true);
    try {
      await onSave(dataSource, {
        filters,
        sorts,
        selected_columns: selectedColumns.length > 0 ? selectedColumns : null,
        limit_count: limitCount,
      });
      toast.success('Veri kaynağı güncellendi');
    } catch (err: any) {
      toast.error(`Hata: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtre ekle
  const addFilter = () => {
    if (allFields.length === 0) return;
    setFilters([
      ...filters,
      { field: allFields[0], operator: '=', value: '' },
    ]);
  };

  // Filtre güncelle
  const updateFilter = (index: number, updates: Partial<DiaApiFilter>) => {
    setFilters(prev => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  // Filtre sil
  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  // Sıralama ekle
  const addSort = () => {
    if (allFields.length === 0) return;
    setSorts([
      ...sorts,
      { field: allFields[0], sorttype: 'ASC' },
    ]);
  };

  // Sıralama güncelle
  const updateSort = (index: number, updates: Partial<DiaApiSort>) => {
    setSorts(prev => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  // Sıralama sil
  const removeSort = (index: number) => {
    setSorts(prev => prev.filter((_, i) => i !== index));
  };

  // Sütun toggle
  const toggleColumn = (field: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      return [...prev, field];
    });
  };

  // Tüm sütunları seç/kaldır
  const toggleAllColumns = () => {
    if (selectedColumns.length === allFields.length || selectedColumns.length === 0) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns([...allFields]);
    }
  };

  // Tablo sütunları (seçili veya tümü)
  const tableColumns = useMemo(() => {
    if (selectedColumns.length > 0) return selectedColumns;
    if (previewData.length > 0) return Object.keys(previewData[0]).filter(k => !k.startsWith('_'));
    return allFields.slice(0, 10);
  }, [selectedColumns, previewData, allFields]);

  // Adım sil
  const removeStep = (stepId: string) => {
    if (stepId === 'source') return;

    if (stepId === 'columns') {
      setSelectedColumns([]);
      return;
    }

    if (stepId.startsWith('filter_')) {
      const idx = parseInt(stepId.replace('filter_', ''));
      removeFilter(idx);
      return;
    }

    if (stepId.startsWith('sort_')) {
      const idx = parseInt(stepId.replace('sort_', ''));
      removeSort(idx);
      return;
    }
  };

  if (!dataSource) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[95vw] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">{dataSource.name}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {dataSource.module}.{dataSource.method}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreview}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Önizle
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                Kaydet
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sol panel - Veri önizleme */}
          <div className="flex-1 flex flex-col border-r overflow-hidden">
            {/* Toolbar */}
            <div className="p-2 border-b bg-muted/30 flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={addFilter}
                className="h-7 text-xs"
              >
                <Filter className="w-3.5 h-3.5 mr-1" />
                Filtre Ekle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addSort}
                className="h-7 text-xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                Sıralama Ekle
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs text-muted-foreground">
                Limit:
              </span>
              <Input
                type="number"
                value={limitCount}
                onChange={(e) => setLimitCount(parseInt(e.target.value) || 100)}
                className="w-20 h-7 text-xs"
                min={0}
                max={10000}
              />
            </div>

            {/* Filter row */}
            {filters.length > 0 && (
              <div className="p-2 border-b bg-muted/20 space-y-1 shrink-0">
                {filters.map((filter, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={filter.field}
                      onValueChange={(v) => updateFilter(idx, { field: v })}
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allFields.map(f => (
                          <SelectItem key={f} value={f} className="text-xs">
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filter.operator || '='}
                      onValueChange={(v) => updateFilter(idx, { operator: v as any })}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPERATORS.map(op => (
                          <SelectItem key={op.id} value={op.id} className="text-xs">
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={filter.value}
                      onChange={(e) => updateFilter(idx, { value: e.target.value })}
                      className="h-7 flex-1 text-xs"
                      placeholder="Değer..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFilter(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Sort row */}
            {sorts.length > 0 && (
              <div className="p-2 border-b bg-muted/20 space-y-1 shrink-0">
                {sorts.map((sort, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Sırala</Badge>
                    <Select
                      value={sort.field}
                      onValueChange={(v) => updateSort(idx, { field: v })}
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allFields.map(f => (
                          <SelectItem key={f} value={f} className="text-xs">
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={sort.sorttype}
                      onValueChange={(v) => updateSort(idx, { sorttype: v as any })}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_TYPES.map(st => (
                          <SelectItem key={st.id} value={st.id} className="text-xs">
                            {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeSort(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">{error}</p>
                  <Button variant="outline" size="sm" onClick={loadPreview}>
                    Tekrar Dene
                  </Button>
                </div>
              ) : previewData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8" />
                  <p className="text-sm">Veri bulunamadı</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {tableColumns.map((col) => (
                        <TableHead key={col} className="text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getFieldTypeIcon(col)}
                            <span>{col}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {tableColumns.map((col) => (
                          <TableCell key={col} className="text-xs py-1.5 max-w-[200px] truncate">
                            {row[col] !== null && row[col] !== undefined
                              ? typeof row[col] === 'object'
                                ? JSON.stringify(row[col])
                                : String(row[col])
                              : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Status bar */}
            <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground shrink-0 flex items-center justify-between">
              <span>
                {previewData.length} kayıt gösteriliyor
                {dataSource.last_record_count && ` (toplam: ${dataSource.last_record_count})`}
              </span>
              <span>
                {tableColumns.length} / {allFields.length} sütun
              </span>
            </div>
          </div>

          {/* Sağ panel - Adımlar ve Özellikler */}
          <div className="w-80 flex flex-col bg-muted/20">
            {/* Özellikler başlığı */}
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Özellikler</span>
              </div>
              <Input
                value={dataSource.name}
                className="mt-2 h-8 text-sm"
                disabled
              />
            </div>

            {/* Sütun seçimi */}
            <div className="border-b">
              <Collapsible
                open={expandedStep === 'columns'}
                onOpenChange={(open) => setExpandedStep(open ? 'columns' : null)}
              >
                <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Columns3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Sütunlar</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedColumns.length > 0 ? selectedColumns.length : allFields.length}
                    </Badge>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    expandedStep === 'columns' && "rotate-90"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Sütun ara..."
                          className="h-7 text-xs pl-7"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={toggleAllColumns}
                      >
                        {selectedColumns.length === allFields.length ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="h-48">
                      <div className="space-y-0.5">
                        {filteredFields.map((field) => (
                          <div
                            key={field}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer",
                              "hover:bg-muted/50 transition-colors",
                              selectedColumns.includes(field) && "bg-primary/10"
                            )}
                            onClick={() => toggleColumn(field)}
                          >
                            <div className={cn(
                              "w-3.5 h-3.5 rounded border flex items-center justify-center",
                              selectedColumns.length === 0 || selectedColumns.includes(field)
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30"
                            )}>
                              {(selectedColumns.length === 0 || selectedColumns.includes(field)) && (
                                <Check className="w-2.5 h-2.5 text-primary-foreground" />
                              )}
                            </div>
                            {getFieldTypeIcon(field)}
                            <span className="truncate">{field}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Uygulanan Adımlar */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Uygulanan Adımlar</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                        "hover:bg-muted/50 transition-colors cursor-pointer",
                        idx === steps.length - 1 && "bg-primary/10 font-medium"
                      )}
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-mono">
                        {idx + 1}
                      </div>
                      {step.type === 'source' && <Database className="w-3.5 h-3.5 text-primary" />}
                      {step.type === 'filter' && <Filter className="w-3.5 h-3.5 text-warning" />}
                      {step.type === 'sort' && <ArrowUpDown className="w-3.5 h-3.5 text-accent-foreground" />}
                      {step.type === 'select_columns' && <Columns3 className="w-3.5 h-3.5 text-secondary-foreground" />}
                      <span className="flex-1 truncate">{step.label}</span>
                      {step.type !== 'source' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeStep(step.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* DIA sorgusu önizleme */}
            <div className="border-t p-3">
              <Collapsible>
                <CollapsibleTrigger className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <div className="flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>DIA Sorgusu</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                    {JSON.stringify(
                      {
                        module: dataSource.module,
                        method: dataSource.method,
                        filters: filters.length > 0 ? filters : undefined,
                        sorts: sorts.length > 0 ? sorts : undefined,
                        selectedcolumns: selectedColumns.length > 0 ? selectedColumns : undefined,
                        limit: limitCount,
                      },
                      null,
                      2
                    )}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
