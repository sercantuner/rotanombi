// Fullscreen Column Selector - Kolon seçimi için tam ekran dialog

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, CheckSquare, Square } from 'lucide-react';

interface FullscreenColumnSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableFields: string[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
  fieldTypes?: Record<string, string>;
}

export function FullscreenColumnSelector({
  open,
  onOpenChange,
  availableFields,
  selectedColumns,
  onChange,
  fieldTypes = {}
}: FullscreenColumnSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>(selectedColumns);

  // Dialog açıldığında local state'i güncelle
  React.useEffect(() => {
    if (open) {
      setLocalSelected(selectedColumns);
      setSearchTerm('');
    }
  }, [open, selectedColumns]);

  const filteredFields = useMemo(() => {
    if (!searchTerm) return availableFields;
    return availableFields.filter(field => 
      field.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableFields, searchTerm]);

  const toggleColumn = (field: string) => {
    setLocalSelected(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const selectAll = () => {
    setLocalSelected([...availableFields]);
  };

  const clearAll = () => {
    setLocalSelected([]);
  };

  const removeSelected = (field: string) => {
    setLocalSelected(prev => prev.filter(f => f !== field));
  };

  const handleApply = () => {
    onChange(localSelected);
    onOpenChange(false);
  };

  const getTypeColor = (field: string) => {
    const type = fieldTypes[field];
    switch (type) {
      case 'number': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'date': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'boolean': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTypeBadgeColor = (field: string) => {
    const type = fieldTypes[field];
    switch (type) {
      case 'number': return 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20';
      case 'date': return 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20';
      case 'boolean': return 'bg-green-500/10 text-green-400 hover:bg-green-500/20';
      default: return 'bg-muted text-muted-foreground hover:bg-muted/80';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Kolon Seçimi</span>
            <span className="text-sm font-normal text-muted-foreground">
              {localSelected.length} / {availableFields.length} seçili
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 border-b space-y-3">
          {/* Arama ve Eylemler */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kolon ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Tümünü Seç
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Square className="h-4 w-4 mr-1" />
              Temizle
            </Button>
          </div>

          {/* Seçili Kolonlar */}
          {localSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
              {localSelected.map(field => (
                <Badge 
                  key={field} 
                  variant="secondary"
                  className={`cursor-pointer ${getTypeBadgeColor(field)}`}
                  onClick={() => removeSelected(field)}
                >
                  {field}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Kolon Listesi */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="grid grid-cols-3 gap-2">
            {filteredFields.map(field => {
              const isSelected = localSelected.includes(field);
              return (
                <label
                  key={field}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    isSelected 
                      ? getTypeColor(field)
                      : 'bg-background hover:bg-muted/50 border-border'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleColumn(field)}
                  />
                  <span className="text-sm truncate" title={field}>
                    {field}
                  </span>
                  {fieldTypes[field] && (
                    <span className="text-[10px] opacity-60 ml-auto">
                      {fieldTypes[field]}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {filteredFields.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Aramayla eşleşen kolon bulunamadı
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleApply}>
            Uygula ({localSelected.length} kolon)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
