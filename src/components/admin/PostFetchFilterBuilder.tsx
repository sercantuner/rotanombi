// PostFetchFilterBuilder - Çekilen veri üzerinde filtreleme bileşeni (Dinamik Değer Seçici ile)

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { Plus, Trash2, Filter, Info, ChevronDown, Search, X, CalendarIcon, Hash } from 'lucide-react';
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

// Alan tipini tespit et
type FieldType = 'text' | 'number' | 'date' | 'boolean';

const detectFieldType = (data: any[], field: string): FieldType => {
  if (!data || !field || data.length === 0) return 'text';
  
  // İlk 10 değere bak
  const sampleValues = data.slice(0, 10).map(row => row[field]).filter(v => v !== null && v !== undefined && v !== '');
  if (sampleValues.length === 0) return 'text';
  
  // Tarih kontrolü - çeşitli formatlar
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // 2024-01-15
    /^\d{2}\.\d{2}\.\d{4}/, // 15.01.2024
    /^\d{2}\/\d{2}\/\d{4}/, // 15/01/2024
  ];
  
  const allDates = sampleValues.every(v => {
    const str = String(v);
    return datePatterns.some(p => p.test(str)) || !isNaN(Date.parse(str));
  });
  if (allDates) return 'date';
  
  // Sayı kontrolü
  const allNumbers = sampleValues.every(v => {
    const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return !isNaN(num) && isFinite(num);
  });
  if (allNumbers) return 'number';
  
  // Boolean kontrolü
  const boolValues = ['true', 'false', '1', '0', 'evet', 'hayır', 'e', 'h'];
  const allBools = sampleValues.every(v => boolValues.includes(String(v).toLowerCase()));
  if (allBools) return 'boolean';
  
  return 'text';
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

// Sayısal min/max hesaplama
const getNumericRange = (data: any[], field: string): { min: number; max: number } | null => {
  if (!data || !field) return null;
  
  const numbers = data
    .map(row => row[field])
    .filter(v => v !== null && v !== undefined)
    .map(v => typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, '')))
    .filter(n => !isNaN(n) && isFinite(n));
  
  if (numbers.length === 0) return null;
  
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
};

// Tarih Seçici Bileşeni
interface DateValueSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function DateValueSelector({ value, onChange, placeholder }: DateValueSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const dateValue = useMemo(() => {
    if (!value) return undefined;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }, [value]);
  
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
    setIsOpen(false);
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, 'dd MMM yyyy', { locale: tr }) : placeholder || 'Tarih seçin'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

// Sayısal Aralık Seçici (Slider)
interface NumericRangeSelectorProps {
  value: string;
  value2?: string;
  onChange: (value: string, value2?: string) => void;
  range: { min: number; max: number };
  operator: FilterOperator;
}

function NumericRangeSelector({ value, value2, onChange, range, operator }: NumericRangeSelectorProps) {
  const isBetween = operator === 'between';
  
  const currentValue = useMemo(() => {
    const v1 = parseFloat(value) || range.min;
    const v2 = parseFloat(value2 || '') || range.max;
    return isBetween ? [v1, v2] : [v1];
  }, [value, value2, range, isBetween]);
  
  const handleSliderChange = (values: number[]) => {
    if (isBetween && values.length === 2) {
      onChange(values[0].toString(), values[1].toString());
    } else if (values.length >= 1) {
      onChange(values[0].toString());
    }
  };
  
  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString('tr-TR');
  };
  
  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={currentValue}
          min={range.min}
          max={range.max}
          step={(range.max - range.min) / 100}
          onValueChange={handleSliderChange}
          className="flex-1"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatNumber(range.min)}</span>
        <span className="font-medium text-foreground">
          {isBetween 
            ? `${formatNumber(currentValue[0])} - ${formatNumber(currentValue[1] || range.max)}`
            : formatNumber(currentValue[0])
          }
        </span>
        <span>{formatNumber(range.max)}</span>
      </div>
      {/* Manuel giriş */}
      <div className="flex gap-2">
        <Input
          type="number"
          className="h-7 text-xs"
          placeholder="Min"
          value={value}
          onChange={(e) => onChange(e.target.value, value2)}
        />
        {isBetween && (
          <Input
            type="number"
            className="h-7 text-xs"
            placeholder="Max"
            value={value2 || ''}
            onChange={(e) => onChange(value, e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

// Dinamik Değer Seçici Bileşeni (Metin için)
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
  
  // Eğer benzersiz değer yoksa, manuel giriş göster
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

// Akıllı Değer Girişi - Tip'e göre uygun bileşeni seçer
interface SmartValueInputProps {
  field: string;
  value: string;
  value2?: string;
  onChange: (value: string, value2?: string) => void;
  operator: FilterOperator;
  sampleData?: any[];
  requiresSecondValue?: boolean;
}

function SmartValueInput({ field, value, value2, onChange, operator, sampleData, requiresSecondValue }: SmartValueInputProps) {
  const fieldType = useMemo(() => detectFieldType(sampleData || [], field), [sampleData, field]);
  const numericRange = useMemo(() => getNumericRange(sampleData || [], field), [sampleData, field]);
  
  // Tarih alanları için DatePicker
  if (fieldType === 'date') {
    if (requiresSecondValue) {
      return (
        <div className="flex gap-2 w-full">
          <DateValueSelector
            value={value}
            onChange={(v) => onChange(v, value2)}
            placeholder="Başlangıç"
          />
          <DateValueSelector
            value={value2 || ''}
            onChange={(v) => onChange(value, v)}
            placeholder="Bitiş"
          />
        </div>
      );
    }
    return (
      <DateValueSelector
        value={value}
        onChange={(v) => onChange(v)}
        placeholder="Tarih seçin"
      />
    );
  }
  
  // Sayısal alanlar için Slider (range varsa ve between/karşılaştırma operatörleri için)
  if (fieldType === 'number' && numericRange && ['>', '<', '>=', '<=', 'between'].includes(operator)) {
    return (
      <NumericRangeSelector
        value={value}
        value2={value2}
        onChange={onChange}
        range={numericRange}
        operator={operator}
      />
    );
  }
  
  // Metin alanları için dinamik seçici
  return (
    <DynamicValueSelector
      field={field}
      value={value}
      onChange={(v) => onChange(v)}
      operator={operator}
      sampleData={sampleData}
      placeholder={operator === 'IN' || operator === 'NOT IN' ? 'Değerler seçin' : 'Değer seçin'}
    />
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

  // Alan tipi bilgisi
  const getFieldTypeLabel = (field: string): string => {
    const type = detectFieldType(sampleData || [], field);
    switch (type) {
      case 'date': return '📅';
      case 'number': return '🔢';
      case 'boolean': return '☑️';
      default: return '📝';
    }
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
                ✓ {sampleData.length} örnek kayıt mevcut - akıllı değer önerileri aktif
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
                    onValueChange={(v) => updateFilter(filter.id, { field: v, value: '', value2: '' })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Alan seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map(field => (
                        <SelectItem key={field} value={field}>
                          <span className="flex items-center gap-2">
                            <span>{getFieldTypeLabel(field)}</span>
                            <span>{field}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operatör seçimi */}
                <div className="w-40 space-y-1">
                  <Label className="text-xs text-muted-foreground">Operatör</Label>
                  <Select
                    value={filter.operator}
                    onValueChange={(v: FilterOperator) => updateFilter(filter.id, { operator: v, value: '', value2: '' })}
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

                {/* Akıllı Değer Girişi */}
                {opConfig.requiresValue && (
                  <div className={cn("space-y-1", opConfig.requiresSecondValue ? "flex-1" : "flex-1")}>
                    <Label className="text-xs text-muted-foreground">
                      Değer
                    </Label>
                    <SmartValueInput
                      field={filter.field}
                      value={filter.value}
                      value2={filter.value2}
                      onChange={(v, v2) => updateFilter(filter.id, { value: v, value2: v2 })}
                      operator={filter.operator}
                      sampleData={sampleData}
                      requiresSecondValue={opConfig.requiresSecondValue}
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