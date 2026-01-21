// FieldWellBuilder - Power BI tarzı alan kuyuları sistemi
// Sürükle-bırak veya tıklama ile alan ataması, seçilen alanların görsel gösterimi

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, Hash, Type, Calendar, ToggleLeft, 
  ArrowRight, Layers, BarChart3, PieChart, Activity, Table2, 
  GripVertical, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartType, AggregationType } from '@/lib/widgetBuilderTypes';
import { FieldWellItem, FieldWellItemData } from './FieldWellItem';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getFieldTypeIcon } from './SearchableFieldSelect';

export interface FieldWellsConfig {
  xAxis?: FieldWellItemData;
  yAxis?: FieldWellItemData[];  // Çoklu seri desteği
  legend?: FieldWellItemData;
  value?: FieldWellItemData;    // KPI, Pie için
  category?: FieldWellItemData; // Pie/Donut için
  tooltip?: FieldWellItemData[];
}

interface FieldWellBuilderProps {
  chartType: ChartType;
  availableFields: string[];
  numericFields: string[];
  fieldTypes?: Record<string, 'text' | 'number' | 'date' | 'boolean'>;
  fieldWells: FieldWellsConfig;
  onChange: (config: FieldWellsConfig) => void;
  sampleData?: any[];
  className?: string;
}

// Yerel alan tipi ikonu (legacy uyumluluk) - SearchableFieldSelect'teki ile aynı
const getFieldIcon = (type?: string) => getFieldTypeIcon(type);

// Grafik tipine göre kuyu yapılandırması
const getWellsForChartType = (chartType: ChartType) => {
  switch (chartType) {
    case 'bar':
    case 'line':
    case 'area':
      return {
        xAxis: { label: 'X Ekseni (Kategori)', icon: <ArrowRight className="h-4 w-4" />, multi: false },
        yAxis: { label: 'Y Ekseni (Değerler)', icon: <BarChart3 className="h-4 w-4" />, multi: true },
        legend: { label: 'Legend (Opsiyonel)', icon: <Layers className="h-4 w-4" />, multi: false, optional: true },
      };
    case 'pie':
    case 'donut':
      return {
        category: { label: 'Kategori', icon: <PieChart className="h-4 w-4" />, multi: false },
        value: { label: 'Değer', icon: <Hash className="h-4 w-4" />, multi: false },
      };
    case 'kpi':
      return {
        value: { label: 'Değer Alanı', icon: <Activity className="h-4 w-4" />, multi: false },
      };
    case 'table':
    case 'list':
      return {
        // Tablo için ayrı bir kolon builder kullanılıyor
      };
    default:
      return {
        xAxis: { label: 'X Ekseni', icon: <ArrowRight className="h-4 w-4" />, multi: false },
        yAxis: { label: 'Y Ekseni', icon: <BarChart3 className="h-4 w-4" />, multi: true },
      };
  }
};

export function FieldWellBuilder({
  chartType,
  availableFields,
  numericFields,
  fieldTypes = {},
  fieldWells,
  onChange,
  sampleData,
  className,
}: FieldWellBuilderProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldsExpanded, setFieldsExpanded] = useState(true);

  // Alan tiplerini tespit et
  const detectedFieldTypes = useMemo(() => {
    if (!sampleData || sampleData.length === 0) return fieldTypes;
    
    const types: Record<string, 'text' | 'number' | 'date' | 'boolean'> = { ...fieldTypes };
    const sample = sampleData[0];
    
    for (const field of availableFields) {
      if (types[field]) continue;
      
      const value = sample[field];
      if (typeof value === 'number') {
        types[field] = 'number';
      } else if (typeof value === 'boolean') {
        types[field] = 'boolean';
      } else if (typeof value === 'string') {
        // Tarih formatını kontrol et
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
          types[field] = 'date';
        } else if (!isNaN(parseFloat(value)) && value.trim() !== '') {
          types[field] = 'number';
        } else {
          types[field] = 'text';
        }
      } else {
        types[field] = 'text';
      }
    }
    
    return types;
  }, [sampleData, availableFields, fieldTypes]);

  // Filtrelenmiş ve A-Z sıralı alanlar
  const filteredFields = useMemo(() => {
    return [...availableFields]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'tr'))
      .filter(field => 
        field.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [availableFields, searchTerm]);

  // Kuyu yapılandırması
  const wellsConfig = getWellsForChartType(chartType);

  // Alan ekleme
  const handleAddField = (wellKey: keyof FieldWellsConfig, field: string) => {
    const fieldType = detectedFieldTypes[field] || 'text';
    const isNumeric = fieldType === 'number';
    
    const newItem: FieldWellItemData = {
      field,
      aggregation: isNumeric ? 'sum' : 'count',
      format: isNumeric ? 'number' : 'text',
    };

    const config = wellsConfig[wellKey as keyof typeof wellsConfig];
    
    if (config?.multi) {
      // Çoklu seri
      const current = (fieldWells[wellKey] as FieldWellItemData[]) || [];
      if (!current.some(item => item.field === field)) {
        onChange({
          ...fieldWells,
          [wellKey]: [...current, newItem],
        });
      }
    } else {
      // Tek alan
      onChange({
        ...fieldWells,
        [wellKey]: newItem,
      });
    }
  };

  // Alan kaldırma
  const handleRemoveField = (wellKey: keyof FieldWellsConfig, index?: number) => {
    const config = wellsConfig[wellKey as keyof typeof wellsConfig];
    
    if (config?.multi && typeof index === 'number') {
      const current = (fieldWells[wellKey] as FieldWellItemData[]) || [];
      onChange({
        ...fieldWells,
        [wellKey]: current.filter((_, i) => i !== index),
      });
    } else {
      onChange({
        ...fieldWells,
        [wellKey]: undefined,
      });
    }
  };

  // Alan güncelleme
  const handleUpdateField = (wellKey: keyof FieldWellsConfig, item: FieldWellItemData, index?: number) => {
    const config = wellsConfig[wellKey as keyof typeof wellsConfig];
    
    if (config?.multi && typeof index === 'number') {
      const current = (fieldWells[wellKey] as FieldWellItemData[]) || [];
      const updated = [...current];
      updated[index] = item;
      onChange({
        ...fieldWells,
        [wellKey]: updated,
      });
    } else {
      onChange({
        ...fieldWells,
        [wellKey]: item,
      });
    }
  };

  // Alan tıklama - ilk boş kuyuya ekle
  const handleFieldClick = (field: string) => {
    const fieldType = detectedFieldTypes[field] || 'text';
    const isNumeric = fieldType === 'number';

    // İlk boş kuyuyu bul
    for (const [key, config] of Object.entries(wellsConfig)) {
      const wellKey = key as keyof FieldWellsConfig;
      const currentValue = fieldWells[wellKey];
      
      if (!config) continue;

      // Numerik alan mı kontrolü
      const wellNeedsNumeric = wellKey === 'yAxis' || wellKey === 'value';
      if (wellNeedsNumeric && !isNumeric) continue;

      if (config.multi) {
        // Çoklu kuyuya her zaman eklenebilir (duplicate kontrolü ile)
        const current = (currentValue as FieldWellItemData[]) || [];
        if (!current.some(item => item.field === field)) {
          handleAddField(wellKey, field);
          return;
        }
      } else if (!currentValue) {
        // Tek alan kuyusu boşsa ekle
        handleAddField(wellKey, field);
        return;
      }
    }
  };

  // Tablo/Liste için özel render yok - ayrı TableColumnBuilder kullanılıyor
  if (['table', 'list'].includes(chartType)) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mevcut Alanlar */}
      <Collapsible open={fieldsExpanded} onOpenChange={setFieldsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 h-9 font-medium"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span>Mevcut Alanlar</span>
              <Badge variant="secondary" className="text-xs">
                {availableFields.length}
              </Badge>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              fieldsExpanded && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card className="border-dashed">
            <CardContent className="p-3 space-y-3">
              {/* Arama */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Alan ara..."
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Alan listesi */}
              <ScrollArea className="h-[120px]">
                <div className="flex flex-wrap gap-1.5">
                  {filteredFields.map(field => {
                    const fieldType = detectedFieldTypes[field];
                    const isUsed = Object.values(fieldWells).some(val => {
                      if (!val) return false;
                      if (Array.isArray(val)) {
                        return val.some(item => item.field === field);
                      }
                      return (val as FieldWellItemData).field === field;
                    });

                    return (
                      <Button
                        key={field}
                        variant={isUsed ? "secondary" : "outline"}
                        size="sm"
                        className={cn(
                          "h-7 text-xs gap-1.5 font-normal",
                          isUsed && "opacity-60"
                        )}
                        onClick={() => handleFieldClick(field)}
                      >
                        {getFieldIcon(fieldType)}
                        <span className="truncate max-w-[120px]">{field}</span>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Alan Kuyuları */}
      <div className="space-y-3">
        {Object.entries(wellsConfig).map(([key, config]) => {
          if (!config) return null;
          
          const wellKey = key as keyof FieldWellsConfig;
          const currentValue = fieldWells[wellKey];
          const isMulti = config.multi;
          const items = isMulti 
            ? (currentValue as FieldWellItemData[] | undefined) || []
            : currentValue ? [currentValue as FieldWellItemData] : [];

          // Hangi alanlar bu kuyuya eklenebilir?
          const wellNeedsNumeric = wellKey === 'yAxis' || wellKey === 'value';
          const eligibleFields = wellNeedsNumeric ? numericFields : availableFields;

          return (
            <Card key={key} className="border-dashed">
              <CardHeader className="py-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                  </div>
                  {isMulti && items.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {items.length} seri
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {/* Mevcut alanlar */}
                {items.map((item, index) => (
                  <FieldWellItem
                    key={`${item.field}-${index}`}
                    item={item}
                    onChange={(updated) => handleUpdateField(wellKey, updated, isMulti ? index : undefined)}
                    onRemove={() => handleRemoveField(wellKey, isMulti ? index : undefined)}
                    fieldType={detectedFieldTypes[item.field]}
                    showAggregation={wellKey === 'yAxis' || wellKey === 'value'}
                    showColor={wellKey === 'yAxis' && isMulti}
                    showFormat={wellKey === 'yAxis' || wellKey === 'value'}
                  />
                ))}

                {/* Boş durum veya ekleme */}
                {(items.length === 0 || isMulti) && (
                  <div className={cn(
                    "flex items-center justify-center p-3 rounded-lg border-2 border-dashed",
                    "text-muted-foreground text-sm",
                    "transition-colors hover:border-primary/50 hover:bg-accent/30"
                  )}>
                    {items.length === 0 ? (
                      <span>Yukarıdan bir alan tıklayın veya sürükleyin</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Seri Ekle
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
