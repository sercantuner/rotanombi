// FilterBuilder - No-code filtre ekleme/silme arayüzü

import { useState } from 'react';
import { DiaApiFilter, FilterOperator, FILTER_OPERATORS } from '@/lib/widgetBuilderTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Filter, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FilterBuilderProps {
  filters: DiaApiFilter[];
  onChange: (filters: DiaApiFilter[]) => void;
  availableFields: string[];
  fieldTypes?: Record<string, string>;
}

export function FilterBuilder({ filters, onChange, availableFields, fieldTypes }: FilterBuilderProps) {
  const addFilter = () => {
    onChange([...filters, { field: '', operator: '=', value: '' }]);
  };

  const updateFilter = (index: number, key: keyof DiaApiFilter, value: string) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const getFieldType = (field: string) => {
    return fieldTypes?.[field] || 'text';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Filtreler</CardTitle>
            {filters.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.length}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={addFilter} className="h-7">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Filtre Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filters.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Henüz filtre eklenmedi. "Filtre Ekle" ile başlayın.
          </p>
        ) : (
          filters.map((filter, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
            >
              {/* Alan Seçimi */}
              <div className="flex-1 min-w-0">
                <Select 
                  value={filter.field} 
                  onValueChange={(v) => updateFilter(index, 'field', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Alan seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.length > 0 ? (
                      availableFields.map(field => (
                        <SelectItem key={field} value={field} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span>{field}</span>
                            {fieldTypes?.[field] && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1">
                                {fieldTypes[field].slice(0, 3)}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground">
                        <Input
                          placeholder="Alan adı yazın..."
                          className="h-7 text-xs"
                          value={filter.field}
                          onChange={(e) => updateFilter(index, 'field', e.target.value)}
                        />
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Operatör Seçimi */}
              <div className="w-28">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select 
                          value={filter.operator || '='} 
                          onValueChange={(v) => updateFilter(index, 'operator', v as FilterOperator)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPERATORS.map(op => (
                              <SelectItem key={op.id} value={op.id} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <code className="bg-muted px-1 rounded">{op.id}</code>
                                  <span>{op.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">
                        {FILTER_OPERATORS.find(op => op.id === (filter.operator || '='))?.example}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Değer Girişi */}
              <div className="flex-1 min-w-0">
                <Input
                  className="h-8 text-xs"
                  placeholder={filter.operator === 'IN' || filter.operator === 'NOT IN' 
                    ? "değer1,değer2,değer3" 
                    : "Değer..."
                  }
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                />
              </div>

              {/* Silme Butonu */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeFilter(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}

        {/* Bilgilendirme */}
        {filters.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <p><strong>IN:</strong> Virgülle ayrılmış çoklu değer (örn: 001,002,003)</p>
              <p><strong>İçeriyor:</strong> Operatör olmadan metin araması yapar</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
