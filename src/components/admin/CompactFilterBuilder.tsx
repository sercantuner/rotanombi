// CompactFilterBuilder - Collapsible ve kompakt filtre arayüzü

import { useState } from 'react';
import { DiaApiFilter, FilterOperator, FILTER_OPERATORS } from '@/lib/widgetBuilderTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactFilterBuilderProps {
  filters: DiaApiFilter[];
  onChange: (filters: DiaApiFilter[]) => void;
  availableFields: string[];
  fieldTypes?: Record<string, string>;
}

export function CompactFilterBuilder({ filters, onChange, availableFields, fieldTypes }: CompactFilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(filters.length > 0);

  const addFilter = () => {
    onChange([...filters, { field: '', operator: '=', value: '' }]);
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
        <div className="p-2 space-y-1.5 max-h-[150px] overflow-y-auto">
          {filters.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              Filtre yok
            </p>
          ) : (
            filters.map((filter, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                {/* Alan */}
                <Select value={filter.field} onValueChange={(v) => updateFilter(index, 'field', v)}>
                  <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                    <SelectValue placeholder="Alan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.length > 0 ? (
                      availableFields.map(field => (
                        <SelectItem key={field} value={field} className="text-xs">{field}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2">
                        <Input
                          placeholder="Alan adı..."
                          className="h-6 text-xs"
                          value={filter.field}
                          onChange={(e) => updateFilter(index, 'field', e.target.value)}
                        />
                      </div>
                    )}
                  </SelectContent>
                </Select>

                {/* Operatör */}
                <Select value={filter.operator || '='} onValueChange={(v) => updateFilter(index, 'operator', v as FilterOperator)}>
                  <SelectTrigger className="h-7 text-xs w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPERATORS.map(op => (
                      <SelectItem key={op.id} value={op.id} className="text-xs">
                        <code>{op.id}</code>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Değer */}
                <Input
                  className="h-7 text-xs flex-1 min-w-0"
                  placeholder="Değer..."
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                />

                {/* Sil */}
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => removeFilter(index)}>
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
