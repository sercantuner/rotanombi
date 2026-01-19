// SortBuilder - No-code sıralama tanımlama arayüzü

import { DiaApiSort, SortType, SORT_TYPES } from '@/lib/widgetBuilderTypes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ArrowUpDown } from 'lucide-react';

interface SortBuilderProps {
  sorts: DiaApiSort[];
  onChange: (sorts: DiaApiSort[]) => void;
  availableFields: string[];
}

export function SortBuilder({ sorts, onChange, availableFields }: SortBuilderProps) {
  const addSort = () => {
    onChange([...sorts, { field: '', sorttype: 'DESC' }]);
  };

  const updateSort = (index: number, key: keyof DiaApiSort, value: string) => {
    const updated = [...sorts];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const removeSort = (index: number) => {
    onChange(sorts.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Sıralama</CardTitle>
            {sorts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {sorts.length}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={addSort} className="h-7">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Sıralama Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Varsayılan sıralama kullanılacak. Özel sıralama için "Sıralama Ekle" tıklayın.
          </p>
        ) : (
          sorts.map((sort, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
            >
              {/* Sıra Numarası */}
              <Badge variant="outline" className="h-6 w-6 flex items-center justify-center text-xs shrink-0">
                {index + 1}
              </Badge>

              {/* Alan Seçimi */}
              <div className="flex-1 min-w-0">
                <Select 
                  value={sort.field} 
                  onValueChange={(v) => updateSort(index, 'field', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sıralama alanı seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.length > 0 ? (
                      availableFields.map(field => (
                        <SelectItem key={field} value={field} className="text-xs">
                          {field}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground">
                        <Input
                          placeholder="Alan adı yazın..."
                          className="h-7 text-xs"
                          value={sort.field}
                          onChange={(e) => updateSort(index, 'field', e.target.value)}
                        />
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Sıralama Tipi */}
              <div className="w-36">
                <Select 
                  value={sort.sorttype} 
                  onValueChange={(v) => updateSort(index, 'sorttype', v as SortType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_TYPES.map(type => (
                      <SelectItem key={type.id} value={type.id} className="text-xs">
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Silme Butonu */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeSort(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}

        {sorts.length > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            Sıralama öncelik sırasına göre uygulanır (1 → 2 → ...)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
