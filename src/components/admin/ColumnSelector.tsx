// ColumnSelector - API test sonuçlarından kolon seçme arayüzü

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Columns, Search, CheckSquare, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnSelectorProps {
  availableFields: string[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
  fieldTypes?: Record<string, string>;
}

export function ColumnSelector({ availableFields, selectedColumns, onChange, fieldTypes }: ColumnSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFields = availableFields.filter(field =>
    field.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleColumn = (field: string) => {
    if (selectedColumns.includes(field)) {
      onChange(selectedColumns.filter(c => c !== field));
    } else {
      onChange([...selectedColumns, field]);
    }
  };

  const selectAll = () => {
    onChange([...availableFields]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const getTypeColor = (field: string) => {
    const type = fieldTypes?.[field] || 'text';
    switch (type) {
      case 'number':
      case 'number-string':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'date':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'boolean':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeLabel = (field: string) => {
    const type = fieldTypes?.[field] || 'text';
    switch (type) {
      case 'number-string':
        return 'num';
      default:
        return type.slice(0, 3);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Columns className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Seçili Kolonlar</CardTitle>
            {selectedColumns.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedColumns.length}/{availableFields.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={selectAll} className="h-7 text-xs">
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Tümü
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll} className="h-7 text-xs">
              <Square className="h-3.5 w-3.5 mr-1" />
              Temizle
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {availableFields.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Önce API testi yaparak mevcut alanları görüntüleyin.
          </p>
        ) : (
          <>
            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Alan ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Seçili Kolonlar Özeti */}
            {selectedColumns.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-muted/50">
                {selectedColumns.map(col => (
                  <Badge 
                    key={col} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-destructive/20"
                    onClick={() => toggleColumn(col)}
                  >
                    {col}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Alan Listesi */}
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {filteredFields.map(field => {
                const isSelected = selectedColumns.includes(field);
                return (
                  <label
                    key={field}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-xs',
                      isSelected
                        ? 'bg-primary/5 border-primary/50'
                        : 'bg-muted/30 border-transparent hover:border-border'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleColumn(field)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate flex-1">{field}</span>
                    {fieldTypes?.[field] && (
                      <span className={cn('text-[9px] px-1 rounded', getTypeColor(field))}>
                        {getTypeLabel(field)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Bilgi */}
            <p className="text-xs text-muted-foreground text-center">
              {selectedColumns.length === 0 
                ? 'Boş bırakırsanız tüm alanlar gelir'
                : `${selectedColumns.length} alan seçildi`
              }
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
