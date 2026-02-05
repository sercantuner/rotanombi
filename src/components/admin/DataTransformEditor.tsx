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
  GripVertical,
  Pencil,
  Binary,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DataSource } from '@/hooks/useDataSources';
import { DiaApiFilter, DiaApiSort, FILTER_OPERATORS, SORT_TYPES } from '@/lib/widgetBuilderTypes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Dönüşüm adımı tipleri
type StepType = 'source' | 'filter' | 'sort' | 'select_columns' | 'rename_column' | 'change_type';

// Veri tipi tanımları
const DATA_TYPES = [
  { id: 'string', name: 'Metin', icon: Type },
  { id: 'number', name: 'Sayı', icon: Hash },
  { id: 'date', name: 'Tarih', icon: Calendar },
  { id: 'boolean', name: 'Evet/Hayır', icon: ToggleLeft },
];

// Sütun dönüşümleri
interface ColumnRename {
  originalName: string;
  newName: string;
}

interface ColumnTypeChange {
  field: string;
  newType: string;
}

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

// Sürüklenebilir adım bileşeni
function SortableStep({
  step,
  index,
  isLast,
  onRemove,
  onEdit,
}: {
  step: TransformStep;
  index: number;
  isLast: boolean;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: step.type === 'source' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getStepIcon = () => {
    switch (step.type) {
      case 'source':
        return <Database className="w-3.5 h-3.5 text-primary" />;
      case 'filter':
        return <Filter className="w-3.5 h-3.5 text-warning" />;
      case 'sort':
        return <ArrowUpDown className="w-3.5 h-3.5 text-accent-foreground" />;
      case 'select_columns':
        return <Columns3 className="w-3.5 h-3.5 text-secondary-foreground" />;
      case 'rename_column':
        return <Pencil className="w-3.5 h-3.5 text-blue-500" />;
      case 'change_type':
        return <Binary className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded text-xs",
        "hover:bg-muted/50 transition-colors",
        isLast && "bg-primary/10 font-medium",
        isDragging && "opacity-50 bg-muted"
      )}
    >
      {step.type !== 'source' && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-mono">
        {index + 1}
      </div>
      {getStepIcon()}
      <span className="flex-1 truncate">{step.label}</span>
      {(step.type === 'rename_column' || step.type === 'change_type') && onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onEdit}
        >
          <Pencil className="w-3 h-3" />
        </Button>
      )}
      {step.type !== 'source' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
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
  
  // Yeni dönüşüm özellikleri
  const [columnRenames, setColumnRenames] = useState<ColumnRename[]>([]);
  const [columnTypeChanges, setColumnTypeChanges] = useState<ColumnTypeChange[]>([]);

  // UI state
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  
  // Modal states
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [typeChangeModalOpen, setTypeChangeModalOpen] = useState(false);
  const [editingRename, setEditingRename] = useState<ColumnRename | null>(null);
  const [editingTypeChange, setEditingTypeChange] = useState<ColumnTypeChange | null>(null);
  const [newRename, setNewRename] = useState<ColumnRename>({ originalName: '', newName: '' });
  const [newTypeChange, setNewTypeChange] = useState<ColumnTypeChange>({ field: '', newType: 'string' });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      // Yeni alanları da yükle (varsa)
      const config = (dataSource as any).transform_config;
      if (config) {
        setColumnRenames(config.renames || []);
        setColumnTypeChanges(config.typeChanges || []);
      } else {
        setColumnRenames([]);
        setColumnTypeChanges([]);
      }
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

    // Sütun adı değiştirme
    columnRenames.forEach((rename, idx) => {
      result.push({
        id: `rename_${idx}`,
        type: 'rename_column',
        label: `Yeniden Adlandır: ${rename.originalName} → ${rename.newName}`,
        config: rename,
        enabled: true,
      });
    });

    // Veri tipi değiştirme
    columnTypeChanges.forEach((change, idx) => {
      const typeName = DATA_TYPES.find(t => t.id === change.newType)?.name || change.newType;
      result.push({
        id: `type_${idx}`,
        type: 'change_type',
        label: `Tip Değiştir: ${change.field} → ${typeName}`,
        config: change,
        enabled: true,
      });
    });

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
  }, [dataSource, selectedColumns, filters, sorts, allFields.length, columnRenames, columnTypeChanges]);

  // Drag end handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex(s => s.id === active.id);
      const newIndex = steps.findIndex(s => s.id === over.id);
      
      // Source'u hareket ettirme
      if (steps[oldIndex].type === 'source' || steps[newIndex].type === 'source') {
        return;
      }

      // Adımları yeniden sırala
      const reorderedSteps = arrayMove(steps, oldIndex, newIndex);
      
      // State'leri güncelle
      const newFilters: DiaApiFilter[] = [];
      const newSorts: DiaApiSort[] = [];
      const newRenames: ColumnRename[] = [];
      const newTypeChanges: ColumnTypeChange[] = [];
      let newSelectedColumns: string[] = selectedColumns;

      reorderedSteps.forEach(step => {
        if (step.type === 'filter') {
          newFilters.push(step.config);
        } else if (step.type === 'sort') {
          newSorts.push(step.config);
        } else if (step.type === 'rename_column') {
          newRenames.push(step.config);
        } else if (step.type === 'change_type') {
          newTypeChanges.push(step.config);
        } else if (step.type === 'select_columns') {
          newSelectedColumns = step.config.columns;
        }
      });

      setFilters(newFilters);
      setSorts(newSorts);
      setColumnRenames(newRenames);
      setColumnTypeChanges(newTypeChanges);
      setSelectedColumns(newSelectedColumns);
    }
  };

  // Veri önizleme
  const loadPreview = useCallback(async () => {
    if (!dataSource) return;

    setIsLoading(true);
    setError(null);

    try {
      // Supabase session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Oturum bulunamadı');

      // MEMORY OPTIMIZATION: Preview için çok düşük limit kullan
      // Ağır sorgular (carikart_vade_bakiye_listele gibi) edge function bellek limitini aşabilir
      const safeLimit = Math.min(limitCount, 20); // Preview için max 20
      
      const payload = {
        module: dataSource.module,
        method: dataSource.method,
        filters: filters.length > 0 ? filters : undefined,
        sorts: sorts.length > 0 ? sorts : undefined,
        selectedcolumns: selectedColumns.length > 0 ? selectedColumns : undefined,
        limit: safeLimit,
      };

      const { data, error: fnError } = await supabase.functions.invoke('dia-api-test', {
        body: payload,
      });

      if (fnError) throw fnError;

      // Edge function dönen verinin yapısını kontrol et
      // sampleData (field stats modu) veya rawResponse (ham veri) olabilir
      if (data?.success) {
        const rawRecords = data?.sampleData || data?.rawResponse || data?.data || [];
        let records = Array.isArray(rawRecords) ? rawRecords : [rawRecords];
        
        // Sütun adı değiştirme uygula
        if (columnRenames.length > 0) {
          records = records.map(row => {
            const newRow = { ...row };
            columnRenames.forEach(rename => {
              if (rename.originalName in newRow) {
                newRow[rename.newName] = newRow[rename.originalName];
                if (rename.originalName !== rename.newName) {
                  delete newRow[rename.originalName];
                }
              }
            });
            return newRow;
          });
        }
        
        // Veri tipi dönüştürme uygula
        if (columnTypeChanges.length > 0) {
          records = records.map(row => {
            const newRow = { ...row };
            columnTypeChanges.forEach(change => {
              if (change.field in newRow) {
                const value = newRow[change.field];
                switch (change.newType) {
                  case 'number':
                    newRow[change.field] = parseFloat(value) || 0;
                    break;
                  case 'string':
                    newRow[change.field] = String(value ?? '');
                    break;
                  case 'boolean':
                    newRow[change.field] = Boolean(value);
                    break;
                  case 'date':
                    // Tarih formatını koru
                    break;
                }
              }
            });
            return newRow;
          });
        }
        
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
  }, [dataSource, filters, sorts, selectedColumns, limitCount, columnRenames, columnTypeChanges]);

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
        // Transform config'i de kaydet (bu alan veritabanına eklenebilir)
      } as any);
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
  // Boş dizi = tüm sütunlar seçili demek, bu durumda tıklanan sütunu kaldır
  const toggleColumn = (field: string) => {
    setSelectedColumns(prev => {
      // Eğer dizi boşsa (tümü seçili), tıklanan hariç tümünü seç
      if (prev.length === 0) {
        return allFields.filter(f => f !== field);
      }
      // Zaten seçiliyse kaldır
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      // Seçili değilse ekle
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

  // Sütun adı değiştir modal aç
  const openRenameModal = (rename?: ColumnRename) => {
    if (rename) {
      setEditingRename(rename);
      setNewRename(rename);
    } else {
      setEditingRename(null);
      setNewRename({ originalName: allFields[0] || '', newName: '' });
    }
    setRenameModalOpen(true);
  };

  // Sütun adı kaydet
  const saveRename = () => {
    if (!newRename.originalName || !newRename.newName) return;
    
    if (editingRename) {
      setColumnRenames(prev => prev.map(r => 
        r.originalName === editingRename.originalName ? newRename : r
      ));
    } else {
      setColumnRenames(prev => [...prev, newRename]);
    }
    setRenameModalOpen(false);
    setEditingRename(null);
  };

  // Sütun adı sil
  const removeRename = (originalName: string) => {
    setColumnRenames(prev => prev.filter(r => r.originalName !== originalName));
  };

  // Veri tipi değiştir modal aç
  const openTypeChangeModal = (change?: ColumnTypeChange) => {
    if (change) {
      setEditingTypeChange(change);
      setNewTypeChange(change);
    } else {
      setEditingTypeChange(null);
      setNewTypeChange({ field: allFields[0] || '', newType: 'string' });
    }
    setTypeChangeModalOpen(true);
  };

  // Veri tipi kaydet
  const saveTypeChange = () => {
    if (!newTypeChange.field) return;
    
    if (editingTypeChange) {
      setColumnTypeChanges(prev => prev.map(c => 
        c.field === editingTypeChange.field ? newTypeChange : c
      ));
    } else {
      setColumnTypeChanges(prev => [...prev, newTypeChange]);
    }
    setTypeChangeModalOpen(false);
    setEditingTypeChange(null);
  };

  // Veri tipi sil
  const removeTypeChange = (field: string) => {
    setColumnTypeChanges(prev => prev.filter(c => c.field !== field));
  };

  // Tablo sütunları (seçili veya tümü)
  const tableColumns = useMemo(() => {
    let cols: string[];
    if (selectedColumns.length > 0) {
      cols = selectedColumns;
    } else if (previewData.length > 0) {
      cols = Object.keys(previewData[0]).filter(k => !k.startsWith('_'));
    } else {
      cols = allFields.slice(0, 10);
    }
    
    // Yeniden adlandırılmış sütunları uygula
    return cols.map(col => {
      const rename = columnRenames.find(r => r.originalName === col);
      return rename ? rename.newName : col;
    });
  }, [selectedColumns, previewData, allFields, columnRenames]);

  // Sütun doluluk oranı hesapla (veri kalitesi)
  const columnCompleteness = useMemo(() => {
    if (previewData.length === 0) return {};
    
    const result: Record<string, { filled: number; total: number; percentage: number }> = {};
    
    tableColumns.forEach(col => {
      // Orijinal sütun adını bul (rename varsa)
      const originalCol = columnRenames.find(r => r.newName === col)?.originalName || col;
      
      let filledCount = 0;
      previewData.forEach(row => {
        const value = row[originalCol] ?? row[col];
        // null, undefined, boş string veya sadece boşluk kontrolü
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          filledCount++;
        }
      });
      
      result[col] = {
        filled: filledCount,
        total: previewData.length,
        percentage: Math.round((filledCount / previewData.length) * 100)
      };
    });
    
    return result;
  }, [previewData, tableColumns, columnRenames]);

  // Doluluk oranına göre renk (semantic tokens ile)
  const getCompletenessColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-chart-2'; // yeşil tonu
    if (percentage >= 70) return 'bg-chart-4'; // sarı tonu
    if (percentage >= 50) return 'bg-chart-3'; // turuncu tonu
    return 'bg-destructive'; // kırmızı tonu
  };
  
  const getCompletenessTextColor = (percentage: number) => {
    if (percentage >= 90) return 'text-chart-2';
    if (percentage >= 70) return 'text-chart-4';
    if (percentage >= 50) return 'text-chart-3';
    return 'text-destructive';
  };

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

    if (stepId.startsWith('rename_')) {
      const idx = parseInt(stepId.replace('rename_', ''));
      const rename = columnRenames[idx];
      if (rename) removeRename(rename.originalName);
      return;
    }

    if (stepId.startsWith('type_')) {
      const idx = parseInt(stepId.replace('type_', ''));
      const change = columnTypeChanges[idx];
      if (change) removeTypeChange(change.field);
      return;
    }
  };

  // Adım düzenle
  const editStep = (stepId: string) => {
    if (stepId.startsWith('rename_')) {
      const idx = parseInt(stepId.replace('rename_', ''));
      const rename = columnRenames[idx];
      if (rename) openRenameModal(rename);
      return;
    }

    if (stepId.startsWith('type_')) {
      const idx = parseInt(stepId.replace('type_', ''));
      const change = columnTypeChanges[idx];
      if (change) openTypeChangeModal(change);
      return;
    }
  };

  if (!dataSource) return null;

  return (
    <>
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
              <div className="p-2 border-b bg-muted/30 flex items-center gap-2 shrink-0 flex-wrap">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openRenameModal()}
                  className="h-7 text-xs"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Sütun Adı Değiştir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openTypeChangeModal()}
                  className="h-7 text-xs"
                >
                  <Binary className="w-3.5 h-3.5 mr-1" />
                  Veri Tipi Dönüştür
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
                        {tableColumns.map((col) => {
                          const completeness = columnCompleteness[col];
                          return (
                            <TableHead key={col} className="text-xs whitespace-nowrap p-0">
                              <div className="flex flex-col">
                                {/* Doluluk oranı göstergesi */}
                                {completeness && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="h-1.5 w-full bg-muted/50 cursor-help">
                                        <div 
                                          className={cn(
                                            "h-full transition-all",
                                            getCompletenessColor(completeness.percentage)
                                          )}
                                          style={{ width: `${completeness.percentage}%` }}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">Veri Kalitesi: %{completeness.percentage}</span>
                                        <span className="text-muted-foreground">
                                          {completeness.filled}/{completeness.total} dolu
                                        </span>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {/* Sütun başlığı */}
                                <div className="flex items-center gap-1.5 px-3 py-2">
                                  {getFieldTypeIcon(col)}
                                  <span>{col}</span>
                                  {completeness && (
                                    <span className={cn(
                                      "text-[9px] font-medium ml-auto",
                                      getCompletenessTextColor(completeness.percentage)
                                    )}>
                                      %{completeness.percentage}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableHead>
                          );
                        })}
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
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Sürükleyerek sıralayabilirsiniz
                  </p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={steps.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {steps.map((step, idx) => (
                          <SortableStep
                            key={step.id}
                            step={step}
                            index={idx}
                            isLast={idx === steps.length - 1}
                            onRemove={() => removeStep(step.id)}
                            onEdit={
                              (step.type === 'rename_column' || step.type === 'change_type')
                                ? () => editStep(step.id)
                                : undefined
                            }
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
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

      {/* Sütun Adı Değiştir Modal */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-500" />
              Sütun Adı Değiştir
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Orijinal Sütun</Label>
              <Select
                value={newRename.originalName}
                onValueChange={(v) => setNewRename(prev => ({ ...prev, originalName: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sütun seçin" />
                </SelectTrigger>
                <SelectContent>
                  {allFields.map(f => (
                    <SelectItem key={f} value={f}>
                      <div className="flex items-center gap-2">
                        {getFieldTypeIcon(f)}
                        <span>{f}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yeni Ad</Label>
              <Input
                value={newRename.newName}
                onChange={(e) => setNewRename(prev => ({ ...prev, newName: e.target.value }))}
                placeholder="Yeni sütun adı..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={saveRename} disabled={!newRename.originalName || !newRename.newName}>
              <Check className="w-4 h-4 mr-1" />
              {editingRename ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Veri Tipi Dönüştür Modal */}
      <Dialog open={typeChangeModalOpen} onOpenChange={setTypeChangeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Binary className="w-5 h-5 text-purple-500" />
              Veri Tipi Dönüştür
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sütun</Label>
              <Select
                value={newTypeChange.field}
                onValueChange={(v) => setNewTypeChange(prev => ({ ...prev, field: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sütun seçin" />
                </SelectTrigger>
                <SelectContent>
                  {allFields.map(f => (
                    <SelectItem key={f} value={f}>
                      <div className="flex items-center gap-2">
                        {getFieldTypeIcon(f)}
                        <span>{f}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yeni Veri Tipi</Label>
              <Select
                value={newTypeChange.newType}
                onValueChange={(v) => setNewTypeChange(prev => ({ ...prev, newType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{type.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeChangeModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={saveTypeChange} disabled={!newTypeChange.field}>
              <Check className="w-4 h-4 mr-1" />
              {editingTypeChange ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
