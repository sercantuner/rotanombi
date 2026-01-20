// PostFetchFilterBuilder - Çekilen veri üzerinde filtreleme bileşeni

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Filter, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Genişletilmiş filtre operatörleri
export type PostFetchOperator = 
  | '=' | '!=' | '>' | '<' | '>=' | '<=' 
  | 'IN' | 'NOT IN' 
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is_null' | 'is_not_null'
  | 'between';

export const POST_FETCH_OPERATORS: { id: PostFetchOperator; name: string; example: string; requiresValue: boolean; requiresSecondValue: boolean }[] = [
  { id: '=', name: 'Eşittir', example: 'alan = "değer"', requiresValue: true, requiresSecondValue: false },
  { id: '!=', name: 'Eşit Değil', example: 'alan != "değer"', requiresValue: true, requiresSecondValue: false },
  { id: '>', name: 'Büyük', example: 'tutar > 1000', requiresValue: true, requiresSecondValue: false },
  { id: '<', name: 'Küçük', example: 'tutar < 1000', requiresValue: true, requiresSecondValue: false },
  { id: '>=', name: 'Büyük Eşit', example: 'tutar >= 1000', requiresValue: true, requiresSecondValue: false },
  { id: '<=', name: 'Küçük Eşit', example: 'tutar <= 1000', requiresValue: true, requiresSecondValue: false },
  { id: 'IN', name: 'İçinde (Çoklu)', example: 'kod IN "A,B,C"', requiresValue: true, requiresSecondValue: false },
  { id: 'NOT IN', name: 'İçinde Değil', example: 'kod NOT IN "X,Y"', requiresValue: true, requiresSecondValue: false },
  { id: 'contains', name: 'İçeriyor', example: 'ad contains "Ltd"', requiresValue: true, requiresSecondValue: false },
  { id: 'not_contains', name: 'İçermiyor', example: 'ad not_contains "Test"', requiresValue: true, requiresSecondValue: false },
  { id: 'starts_with', name: 'İle Başlar', example: 'kod starts_with "TR"', requiresValue: true, requiresSecondValue: false },
  { id: 'ends_with', name: 'İle Biter', example: 'ad ends_with "AŞ"', requiresValue: true, requiresSecondValue: false },
  { id: 'is_null', name: 'Boş', example: 'alan is_null', requiresValue: false, requiresSecondValue: false },
  { id: 'is_not_null', name: 'Dolu', example: 'alan is_not_null', requiresValue: false, requiresSecondValue: false },
  { id: 'between', name: 'Arasında', example: 'tutar between "100,500"', requiresValue: true, requiresSecondValue: true },
];

export interface PostFetchFilter {
  id: string;
  field: string;
  operator: PostFetchOperator;
  value: string;
  value2?: string; // between için ikinci değer
  logicalOperator: 'AND' | 'OR';
}

interface PostFetchFilterBuilderProps {
  filters: PostFetchFilter[];
  onChange: (filters: PostFetchFilter[]) => void;
  availableFields: string[];
}

const generateId = () => `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function PostFetchFilterBuilder({ filters, onChange, availableFields }: PostFetchFilterBuilderProps) {
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

  const getOperatorConfig = (op: PostFetchOperator) => {
    return POST_FETCH_OPERATORS.find(o => o.id === op) || POST_FETCH_OPERATORS[0];
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
          </div>
        )}

        {filters.map((filter, index) => {
          const opConfig = getOperatorConfig(filter.operator);
          
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
                    onValueChange={(v) => updateFilter(filter.id, { field: v })}
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
                    onValueChange={(v: PostFetchOperator) => updateFilter(filter.id, { operator: v, value2: '' })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_FETCH_OPERATORS.map(op => (
                        <SelectItem key={op.id} value={op.id}>
                          <span className="font-medium">{op.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Değer girişi */}
                {opConfig.requiresValue && (
                  <div className={cn("space-y-1", opConfig.requiresSecondValue ? "w-28" : "flex-1")}>
                    <Label className="text-xs text-muted-foreground">
                      {opConfig.requiresSecondValue ? 'Min' : 'Değer'}
                    </Label>
                    <Input
                      className="h-9"
                      placeholder={filter.operator === 'IN' || filter.operator === 'NOT IN' ? 'A,B,C' : 'Değer'}
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
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
