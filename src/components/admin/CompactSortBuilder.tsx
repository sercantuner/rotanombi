// CompactSortBuilder - Collapsible ve kompakt sıralama arayüzü

import { useState } from 'react';
import { DiaApiSort, SortType, SORT_TYPES } from '@/lib/widgetBuilderTypes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';

interface CompactSortBuilderProps {
  sorts: DiaApiSort[];
  onChange: (sorts: DiaApiSort[]) => void;
  availableFields: string[];
}

export function CompactSortBuilder({ sorts, onChange, availableFields }: CompactSortBuilderProps) {
  const [isOpen, setIsOpen] = useState(sorts.length > 0);

  const addSort = () => {
    onChange([...sorts, { field: '', sorttype: 'DESC' }]);
    setIsOpen(true);
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            Sıralama
            {sorts.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {sorts.length}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        <Button size="sm" variant="ghost" onClick={addSort} className="h-6 text-xs px-2">
          <Plus className="h-3 w-3 mr-1" />
          Ekle
        </Button>
      </div>
      
      <CollapsibleContent>
        <div className="p-2 space-y-1.5 max-h-[120px] overflow-y-auto">
          {sorts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              Varsayılan sıralama
            </p>
          ) : (
            sorts.map((sort, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                {/* Sıra */}
                <Badge variant="outline" className="h-5 w-5 flex items-center justify-center text-[10px] shrink-0">
                  {index + 1}
                </Badge>

                {/* Alan */}
                <Select value={sort.field} onValueChange={(v) => updateSort(index, 'field', v)}>
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
                          value={sort.field}
                          onChange={(e) => updateSort(index, 'field', e.target.value)}
                        />
                      </div>
                    )}
                  </SelectContent>
                </Select>

                {/* Tip */}
                <Select value={sort.sorttype} onValueChange={(v) => updateSort(index, 'sorttype', v as SortType)}>
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_TYPES.map(type => (
                      <SelectItem key={type.id} value={type.id} className="text-xs">{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sil */}
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => removeSort(index)}>
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
