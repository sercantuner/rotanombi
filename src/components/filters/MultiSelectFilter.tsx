// MultiSelect Filter - Çoklu seçim filtre bileşeni
import React, { useState, useMemo } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MultiSelectFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[] | string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  maxDisplay?: number;
  className?: string;
  disabled?: boolean;
  lockedValue?: string;
}

export function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onChange,
  placeholder = 'Seçin...',
  searchable = true,
  maxDisplay = 2,
  className,
  disabled = false,
  lockedValue,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize options to { value, label } format
  const normalizedOptions = useMemo(() => {
    return options.map(opt => 
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
  }, [options]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return normalizedOptions;
    const query = searchQuery.toLowerCase();
    return normalizedOptions.filter(opt => 
      opt.label.toLowerCase().includes(query) || 
      opt.value.toLowerCase().includes(query)
    );
  }, [normalizedOptions, searchQuery]);

  const toggleOption = (value: string) => {
    if (lockedValue && value === lockedValue) return;
    
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const clearAll = () => {
    if (lockedValue) {
      onChange([lockedValue]);
    } else {
      onChange([]);
    }
  };

  const selectAll = () => {
    const allValues = normalizedOptions.map(opt => opt.value);
    onChange(allValues);
  };

  // Display text
  const displayText = useMemo(() => {
    if (lockedValue && selected.length === 0) {
      return `🔒 ${normalizedOptions.find(o => o.value === lockedValue)?.label || lockedValue}`;
    }
    if (selected.length === 0) return placeholder;
    if (selected.length <= maxDisplay) {
      return selected.map(v => normalizedOptions.find(o => o.value === v)?.label || v).join(', ');
    }
    return `${selected.length} seçili`;
  }, [selected, lockedValue, normalizedOptions, placeholder, maxDisplay]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn(
            'justify-between gap-2 min-w-[140px]',
            selected.length > 0 && 'border-primary bg-primary/5',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{displayText}</span>
          </div>
          <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {/* Search */}
        {searchable && normalizedOptions.length > 5 && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
        )}

        {/* Options */}
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-1">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sonuç bulunamadı
              </p>
            ) : (
              filteredOptions.map((option) => {
                const isLocked = lockedValue === option.value;
                const isSelected = selected.includes(option.value) || isLocked;
                
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                      isLocked 
                        ? 'bg-warning/10 cursor-not-allowed' 
                        : 'hover:bg-muted',
                      isSelected && !isLocked && 'bg-primary/10'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOption(option.value)}
                      disabled={isLocked}
                    />
                    <span className={cn(
                      'text-sm flex-1',
                      isLocked && 'text-warning'
                    )}>
                      {isLocked && '🔒 '}{option.label}
                    </span>
                    {isSelected && !isLocked && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-2 border-t flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
            onClick={selectAll}
          >
            Tümünü Seç
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
            onClick={clearAll}
            disabled={selected.length === 0}
          >
            Temizle
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
