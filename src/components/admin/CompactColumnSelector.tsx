// CompactColumnSelector - Collapsible ve kompakt kolon seçici

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Columns, Search, CheckSquare, Square, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactColumnSelectorProps {
  availableFields: string[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
  fieldTypes?: Record<string, string>;
}

export function CompactColumnSelector({ availableFields, selectedColumns, onChange, fieldTypes }: CompactColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(selectedColumns.length > 0);
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

  const selectAll = () => onChange([...availableFields]);
  const clearAll = () => onChange([]);

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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Columns className="h-3.5 w-3.5 text-muted-foreground" />
            Kolonlar
            {selectedColumns.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {selectedColumns.length}/{availableFields.length}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={selectAll} className="h-6 text-[10px] px-1.5">
            <CheckSquare className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} className="h-6 text-[10px] px-1.5">
            <Square className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <CollapsibleContent>
        <div className="p-2 space-y-2">
          {availableFields.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              API testi yapın
            </p>
          ) : (
            <>
              {/* Arama */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  className="pl-7 h-7 text-xs"
                  placeholder="Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Seçili */}
              {selectedColumns.length > 0 && (
                <div className="flex flex-wrap gap-1 p-1.5 rounded bg-muted/50 max-h-[60px] overflow-y-auto">
                  {selectedColumns.slice(0, 8).map(col => (
                    <Badge 
                      key={col} 
                      variant="secondary" 
                      className="text-[10px] h-5 cursor-pointer hover:bg-destructive/20"
                      onClick={() => toggleColumn(col)}
                    >
                      {col.length > 12 ? col.slice(0, 12) + '...' : col}
                      <X className="h-2.5 w-2.5 ml-0.5" />
                    </Badge>
                  ))}
                  {selectedColumns.length > 8 && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      +{selectedColumns.length - 8}
                    </Badge>
                  )}
                </div>
              )}

              {/* Liste */}
              <div className="grid grid-cols-2 gap-1 max-h-[100px] overflow-y-auto">
                {filteredFields.map(field => {
                  const isSelected = selectedColumns.includes(field);
                  return (
                    <label
                      key={field}
                      className={cn(
                        'flex items-center gap-1.5 p-1.5 rounded cursor-pointer text-[11px] transition-colors',
                        isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleColumn(field)}
                        className="h-3 w-3"
                      />
                      <span className="truncate flex-1">{field}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
