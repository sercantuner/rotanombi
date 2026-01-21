// CompactFilterBuilder - Akıllı değer seçici ile kompakt filtre arayüzü

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { DiaApiFilter, FilterOperator } from '@/lib/widgetBuilderTypes';
import { detectFieldType, getUniqueValues, getNumericRange, formatNumber, FieldType } from '@/lib/filterUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Filter, ChevronDown, ChevronRight, CalendarIcon, Hash, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompactSearchableFieldSelect, getFieldTypeIcon } from './SearchableFieldSelect';

// DIA API'nin desteklediği operatörler
// NOT: "contains" operatör göndermezse DIA "içeren" gibi çalışır
// "!" operatörü "içermeyen" anlamına gelir
const DIA_FILTER_OPERATORS = [
  { id: 'contains', label: 'İçerir (varsayılan)', description: 'Alanın içinde geçen' },
  { id: '=', label: 'Eşit', description: 'Tam eşleşme' },
  { id: '!=', label: 'Eşit Değil', description: 'Eşit olmayan' },
  { id: '!', label: 'İçermez', description: 'İçinde geçmeyen' },
  { id: '>', label: 'Büyük', description: 'Daha büyük' },
  { id: '<', label: 'Küçük', description: 'Daha küçük' },
  { id: '>=', label: 'Büyük Eşit', description: 'Büyük veya eşit' },
  { id: '<=', label: 'Küçük Eşit', description: 'Küçük veya eşit' },
  { id: 'IN', label: 'Liste İçinde', description: 'Virgülle ayrılmış değerlerden biri' },
  { id: 'NOT IN', label: 'Liste Dışında', description: 'Listedeki değerler hariç' },
];

interface CompactFilterBuilderProps {
  filters: DiaApiFilter[];
  onChange: (filters: DiaApiFilter[]) => void;
  availableFields: string[];
  fieldTypes?: Record<string, string>;
  sampleData?: any[]; // Akıllı öneri için
}

// Kompakt Tarih Seçici
interface CompactDateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function CompactDateSelector({ value, onChange, placeholder }: CompactDateSelectorProps) {
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
            "h-7 text-xs justify-start font-normal flex-1 min-w-0",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1 h-3 w-3" />
          {dateValue ? format(dateValue, 'dd.MM.yyyy', { locale: tr }) : placeholder || 'Tarih'}
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

// Kompakt Sayısal Slider
interface CompactNumericSelectorProps {
  value: string;
  onChange: (value: string) => void;
  range: { min: number; max: number };
}

function CompactNumericSelector({ value, onChange, range }: CompactNumericSelectorProps) {
  const currentValue = useMemo(() => {
    const v = parseFloat(value) || range.min;
    return [Math.min(Math.max(v, range.min), range.max)];
  }, [value, range]);
  
  const handleSliderChange = (values: number[]) => {
    if (values.length >= 1) {
      onChange(values[0].toString());
    }
  };
  
  return (
    <div className="flex-1 space-y-1 min-w-[120px]">
      <div className="flex items-center gap-1">
        <Hash className="h-3 w-3 text-muted-foreground" />
        <Slider
          value={currentValue}
          min={range.min}
          max={range.max}
          step={(range.max - range.min) / 100}
          onValueChange={handleSliderChange}
          className="flex-1"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatNumber(range.min)}</span>
        <span className="font-medium text-foreground">{formatNumber(currentValue[0])}</span>
        <span>{formatNumber(range.max)}</span>
      </div>
      <Input
        type="number"
        className="h-6 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Değer"
      />
    </div>
  );
}

// Kompakt Metin Seçici (Multi-select dropdown)
interface CompactTextSelectorProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
  operator: FilterOperator;
  sampleData?: any[];
}

function CompactTextSelector({ field, value, onChange, operator, sampleData }: CompactTextSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const uniqueValues = useMemo(() => {
    return getUniqueValues(sampleData || [], field, 100);
  }, [sampleData, field]);
  
  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [uniqueValues, searchTerm]);
  
  const selectedValues = useMemo(() => {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }, [value]);
  
  const toggleValue = (val: string) => {
    if (operator === 'IN' || operator === 'NOT IN') {
      const current = selectedValues;
      if (current.includes(val)) {
        onChange(current.filter(v => v !== val).join(','));
      } else {
        onChange([...current, val].join(','));
      }
    } else {
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
        className="h-7 text-xs flex-1 min-w-0"
        placeholder="Değer..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  
  const isMultiSelect = operator === 'IN' || operator === 'NOT IN';
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-7 text-xs justify-between font-normal flex-1 min-w-0",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selectedValues.length > 0 
              ? isMultiSelect 
                ? `${selectedValues.length} seçili`
                : selectedValues[0]
              : 'Değer seç'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="flex items-center border-b px-2 py-1.5 gap-1">
          <Search className="h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-6 border-0 p-0 focus-visible:ring-0 text-xs"
          />
          {(searchTerm || selectedValues.length > 0) && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearAll}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[160px]">
          <div className="p-1 space-y-0.5">
            {filteredValues.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-3">
                Sonuç bulunamadı
              </p>
            ) : (
              filteredValues.map((val) => (
                <div
                  key={val}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors text-xs",
                    selectedValues.includes(val) 
                      ? "bg-primary/10 text-primary" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => toggleValue(val)}
                >
                  {isMultiSelect && (
                    <Checkbox
                      checked={selectedValues.includes(val)}
                      className="h-3 w-3"
                    />
                  )}
                  <span className="truncate flex-1">{val}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t p-1.5">
          <Input
            placeholder="Manuel giriş..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 text-[10px]"
          />
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {uniqueValues.length} benzersiz değer
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
  onChange: (value: string) => void;
  operator: FilterOperator;
  sampleData?: any[];
}

function SmartValueInput({ field, value, onChange, operator, sampleData }: SmartValueInputProps) {
  const fieldType = useMemo(() => detectFieldType(sampleData || [], field), [sampleData, field]);
  const numericRange = useMemo(() => getNumericRange(sampleData || [], field), [sampleData, field]);
  
  // Tarih alanları için DatePicker
  if (fieldType === 'date') {
    return (
      <CompactDateSelector
        value={value}
        onChange={onChange}
        placeholder="Tarih seçin"
      />
    );
  }
  
  // Sayısal alanlar için Slider (range varsa ve karşılaştırma operatörleri için)
  if (fieldType === 'number' && numericRange && ['>', '<', '>=', '<='].includes(operator)) {
    return (
      <CompactNumericSelector
        value={value}
        onChange={onChange}
        range={numericRange}
      />
    );
  }
  
  // Metin alanları için dinamik seçici
  if (sampleData && sampleData.length > 0) {
    return (
      <CompactTextSelector
        field={field}
        value={value}
        onChange={onChange}
        operator={operator}
        sampleData={sampleData}
      />
    );
  }
  
  // Fallback: basit input
  return (
    <Input
      className="h-7 text-xs flex-1 min-w-0"
      placeholder="Değer..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Alan tipi gösterimi
function getFieldTypeIndicator(sampleData: any[] | undefined, field: string): string {
  if (!sampleData || !field) return '';
  const type = detectFieldType(sampleData, field);
  switch (type) {
    case 'date': return '📅';
    case 'number': return '🔢';
    case 'boolean': return '☑️';
    default: return '';
  }
}

export function CompactFilterBuilder({ filters, onChange, availableFields, fieldTypes, sampleData }: CompactFilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(filters.length > 0);

  const addFilter = () => {
    // Varsayılan operatör "contains" - DIA'ya gönderilmeyecek
    onChange([...filters, { field: '', operator: 'contains' as FilterOperator, value: '' }]);
    setIsOpen(true);
  };

  const updateFilter = (index: number, key: keyof DiaApiFilter, value: string) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            Filtreler
            {filters.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {filters.length}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        <Button size="sm" variant="ghost" onClick={addFilter} className="h-6 text-xs px-2">
          <Plus className="h-3 w-3 mr-1" />
          Ekle
        </Button>
      </div>
      
      <CollapsibleContent>
        <div className="p-2 space-y-2 max-h-[200px] overflow-y-auto">
          {filters.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              Filtre yok
            </p>
          ) : (
            filters.map((filter, index) => (
              <div key={index} className="flex items-start gap-1.5 text-xs">
                {/* Alan - Aranabilir Select */}
                <CompactSearchableFieldSelect
                  value={filter.field}
                  onValueChange={(v) => updateFilter(index, 'field', v === '__none__' ? '' : v)}
                  fields={availableFields}
                  fieldTypes={fieldTypes}
                  placeholder="Alan..."
                  className="w-[130px] shrink-0"
                />

                {/* Operatör */}
                <Select value={filter.operator || 'contains'} onValueChange={(v) => updateFilter(index, 'operator', v as FilterOperator)}>
                  <SelectTrigger className="h-7 text-xs w-[100px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIA_FILTER_OPERATORS.map(op => (
                      <SelectItem key={op.id} value={op.id} className="text-xs">
                        <span title={op.description}>{op.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Akıllı Değer Girişi */}
                <SmartValueInput
                  field={filter.field}
                  value={filter.value}
                  onChange={(v) => updateFilter(index, 'value', v)}
                  operator={filter.operator as FilterOperator}
                  sampleData={sampleData}
                />

                {/* Sil */}
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeFilter(index)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
