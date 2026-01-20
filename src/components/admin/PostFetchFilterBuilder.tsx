// PostFetchFilterBuilder - Çekilen veri üzerinde filtreleme bileşeni (Dinamik Değer Seçici ile)

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, Filter, Info, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PostFetchFilter, FilterOperator, FILTER_OPERATORS } from '@/lib/widgetBuilderTypes';

// Re-export for convenience
export type { PostFetchFilter };

interface PostFetchFilterBuilderProps {
  filters: PostFetchFilter[];
  onChange: (filters: PostFetchFilter[]) => void;
  availableFields: string[];
  sampleData?: any[]; // Filtreleme için örnek veriler
}

const generateId = () => `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Operatör için value gerekliliği
const getOperatorConfig = (op: FilterOperator) => {
  const config = FILTER_OPERATORS.find(o => o.id === op);
  return {
    requiresValue: config?.requiresValue !== false,
    requiresSecondValue: config?.requiresSecondValue === true,
  };
};

// Benzersiz değerler hesaplama
const getUniqueValues = (data: any[], field: string, maxCount = 50): string[] => {
  if (!data || !field) return [];
  
  const values = data
    .map(row => row[field])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => String(v));
  
  const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b, 'tr'));
  return unique.slice(0, maxCount);
};

// Dinamik Değer Seçici Bileşeni
interface DynamicValueSelectorProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
  operator: FilterOperator;
  sampleData?: any[];
  placeholder?: string;
}

function DynamicValueSelector({ field, value, onChange, operator, sampleData, placeholder }: DynamicValueSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const uniqueValues = useMemo(() => {
    return getUniqueValues(sampleData || [], field);
  }, [sampleData, field]);
  
  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [uniqueValues, searchTerm]);
  
  // Mevcut seçili değerler (virgülle ayrılmış)
  const selectedValues = useMemo(() => {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }, [value]);
  
  const toggleValue = (val: string) => {
    if (operator === 'IN' || operator === 'NOT IN') {
      // Çoklu seçim modu
      const current = selectedValues;
      if (current.includes(val)) {
        onChange(current.filter(v => v !== val).join(','));
      } else {
        onChange([...current, val].join(','));
      }
    } else {
      // Tekli seçim modu
      onChange(val);
      setIsOpen(false);
    }
  };
  
  const clearAll = () => {
    onChange('');
    setSearchTerm('');
  };
  
  // Eğer benzersiz değer yoksa veya çok fazla ise (50+), manuel giriş göster
  if (uniqueValues.length === 0) {
    return (
      <Input
        className="h-9"
        placeholder={placeholder || 'Değer girin'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  
  // Benzersiz değer varsa, akıllı seçici göster
  const isMultiSelect = operator === 'IN' || operator === 'NOT IN';
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-9 w-full justify-between text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selectedValues.length > 0 
              ? isMultiSelect 
                ? `${selectedValues.length} seçili`
                : selectedValues[0]
              : placeholder || 'Değer seçin'}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 border-0 p-0 focus-visible:ring-0 text-sm"
          />
          {(searchTerm || selectedValues.length > 0) && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearAll}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-0.5">
            {filteredValues.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sonuç bulunamadı
              </p>
            ) : (
              filteredValues.map((val) => (
                <div
                  key={val}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors",
                    selectedValues.includes(val) 
                      ? "bg-primary/10 text-primary" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => toggleValue(val)}
                >
                  {isMultiSelect && (
                    <Checkbox
                      checked={selectedValues.includes(val)}
                      className="h-4 w-4"
                    />
                  )}
                  <span className="text-sm truncate flex-1">{val}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Manuel giriş opsiyonu */}
        <div className="border-t p-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Manuel giriş..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {uniqueValues.length} benzersiz değer • {isMultiSelect ? 'Virgülle ayırarak çoklu giriş' : 'Tek değer seçin'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PostFetchFilterBuilder({ filters, onChange, availableFields, sampleData }: PostFetchFilterBuilderProps) {
  const addFilter = () => {
    onChange([...filters, {
      id: generateId(),
      field: availableFields[0] || '',
      operator: '=',
      value: '',
      logicalOperator: 'AND',
    }]);
  };

  const updateFilter = (id: string, updates: Partial<PostFetchFilter>) => {
    onChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter(f => f.id !== id));
  };

  const getOpConfig = (op: FilterOperator) => {
    return getOperatorConfig(op);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          Veri Filtreleme (Post-Fetch)
        </CardTitle>
        <CardDescription>
          Çekilen veri üzerinde ek filtreler uygulayın - API çağrısı yapmaz, kontör tasarrufu sağlar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.length === 0 && (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Henüz filtre eklenmedi. Veri kaynağından çekilen veriler üzerinde filtreleme yapabilirsiniz.
            </p>
            {sampleData && sampleData.length > 0 && (
              <p className="text-xs text-green-600 mt-2">
                ✓ {sampleData.length} örnek kayıt mevcut - değer önerileri aktif
              </p>
            )}
          </div>
        )}

        {filters.map((filter, index) => {
          const opConfig = getOpConfig(filter.operator);
          
          return (
            <div key={filter.id} className="space-y-2">
              {/* Mantıksal operatör (ilk hariç) */}
              {index > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-border" />
                  <Select
                    value={filter.logicalOperator}
                    onValueChange={(v: 'AND' | 'OR') => updateFilter(filter.id, { logicalOperator: v })}
                  >
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">VE</SelectItem>
                      <SelectItem value="OR">VEYA</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              
              <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border">
                {/* Alan seçimi */}
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Alan</Label>
                  <Select
                    value={filter.field}
                    onValueChange={(v) => updateFilter(filter.id, { field: v, value: '' })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Alan seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map(field => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operatör seçimi */}
                <div className="w-40 space-y-1">
                  <Label className="text-xs text-muted-foreground">Operatör</Label>
                  <Select
                    value={filter.operator}
                    onValueChange={(v: FilterOperator) => updateFilter(filter.id, { operator: v, value2: '' })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map(op => (
                        <SelectItem key={op.id} value={op.id}>
                          <span className="font-medium">{op.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Değer girişi - Dinamik Seçici */}
                {opConfig.requiresValue && (
                  <div className={cn("space-y-1", opConfig.requiresSecondValue ? "w-28" : "flex-1")}>
                    <Label className="text-xs text-muted-foreground">
                      {opConfig.requiresSecondValue ? 'Min' : 'Değer'}
                    </Label>
                    <DynamicValueSelector
                      field={filter.field}
                      value={filter.value}
                      onChange={(val) => updateFilter(filter.id, { value: val })}
                      operator={filter.operator}
                      sampleData={sampleData}
                      placeholder={filter.operator === 'IN' || filter.operator === 'NOT IN' ? 'Değerler seçin' : 'Değer seçin'}
                    />
                  </div>
                )}

                {/* İkinci değer (between için) */}
                {opConfig.requiresSecondValue && (
                  <div className="w-28 space-y-1">
                    <Label className="text-xs text-muted-foreground">Max</Label>
                    <Input
                      className="h-9"
                      placeholder="Max"
                      value={filter.value2 || ''}
                      onChange={(e) => updateFilter(filter.id, { value2: e.target.value })}
                    />
                  </div>
                )}

                {/* Silme butonu */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 mt-5 text-destructive hover:text-destructive"
                  onClick={() => removeFilter(filter.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={addFilter}
          disabled={availableFields.length === 0}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Filtre Ekle
        </Button>

        {availableFields.length === 0 && (
          <p className="text-xs text-amber-600 text-center">
            Önce bir veri kaynağı seçin
          </p>
        )}

        {/* Özet */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {filters.map((f, i) => (
              <Badge key={f.id} variant="secondary" className="text-xs">
                {i > 0 && <span className="text-primary mr-1">{f.logicalOperator}</span>}
                {f.field} {f.operator} {f.value}{f.value2 ? ` - ${f.value2}` : ''}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Filtreleri veriye uygulama fonksiyonu
export function applyPostFetchFilters(data: any[], filters: PostFetchFilter[]): any[] {
  if (!filters || filters.length === 0) return data;

  return data.filter(row => {
    let result = true;
    let currentLogical: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const fieldValue = row[filter.field];
      let matches = false;

      const strValue = String(fieldValue ?? '').toLowerCase();
      const filterValue = filter.value.toLowerCase();
      const numValue = parseFloat(String(fieldValue).replace(/[^\d.-]/g, '')) || 0;
      const filterNumValue = parseFloat(filter.value) || 0;
      const filterNumValue2 = parseFloat(filter.value2 || '') || 0;

      switch (filter.operator) {
        case '=':
          matches = strValue === filterValue;
          break;
        case '!=':
          matches = strValue !== filterValue;
          break;
        case '>':
          matches = numValue > filterNumValue;
          break;
        case '<':
          matches = numValue < filterNumValue;
          break;
        case '>=':
          matches = numValue >= filterNumValue;
          break;
        case '<=':
          matches = numValue <= filterNumValue;
          break;
        case 'IN':
          const inValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = inValues.includes(strValue);
          break;
        case 'NOT IN':
          const notInValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = !notInValues.includes(strValue);
          break;
        case 'contains':
          matches = strValue.includes(filterValue);
          break;
        case 'not_contains':
          matches = !strValue.includes(filterValue);
          break;
        case 'starts_with':
          matches = strValue.startsWith(filterValue);
          break;
        case 'ends_with':
          matches = strValue.endsWith(filterValue);
          break;
        case 'is_null':
          matches = fieldValue === null || fieldValue === undefined || fieldValue === '';
          break;
        case 'is_not_null':
          matches = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
          break;
        case 'between':
          matches = numValue >= filterNumValue && numValue <= filterNumValue2;
          break;
        default:
          matches = true;
      }

      if (i === 0) {
        result = matches;
      } else {
        if (currentLogical === 'AND') {
          result = result && matches;
        } else {
          result = result || matches;
        }
      }

      currentLogical = filter.logicalOperator;
    }

    return result;
  });
}