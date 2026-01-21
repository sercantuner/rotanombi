// SearchableFieldSelect - Widget Builder için aranabilir alan seçici
// Tüm veri seçme alanlarında tutarlı arama, ikon ve A-Z sıralama sağlar

import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Hash, Type, Calendar, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

// Alan tipi ikonu - tüm seçicilerde aynı ikonlar kullanılır
export const getFieldTypeIcon = (type?: string) => {
  switch (type) {
    case 'number':
    case 'number-string':
      return <Hash className="h-3.5 w-3.5 text-blue-500" />;
    case 'date':
      return <Calendar className="h-3.5 w-3.5 text-amber-500" />;
    case 'boolean':
      return <ToggleLeft className="h-3.5 w-3.5 text-purple-500" />;
    default:
      return <Type className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

interface SearchableFieldSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  fields: string[];
  fieldTypes?: Record<string, string>;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  showNoneOption?: boolean;
  noneLabel?: string;
}

export function SearchableFieldSelect({
  value,
  onValueChange,
  fields,
  fieldTypes = {},
  placeholder = 'Alan seçin...',
  emptyMessage = 'Alan bulunamadı',
  className,
  triggerClassName,
  disabled = false,
  showNoneOption = false,
  noneLabel = 'Seçim yok',
}: SearchableFieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // A-Z sıralı ve filtrelenmiş alanlar
  const sortedAndFilteredFields = useMemo(() => {
    const sorted = [...fields].sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase(), 'tr')
    );
    
    if (!searchQuery) return sorted;
    
    return sorted.filter(field =>
      field.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [fields, searchQuery]);

  const selectedLabel = value && value !== '__none__' 
    ? value 
    : showNoneOption && value === '__none__' 
      ? noneLabel 
      : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {value && value !== '__none__' && getFieldTypeIcon(fieldTypes[value])}
            <span className="truncate">{selectedLabel || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-0", className)} align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-[200px]">
                {showNoneOption && (
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      onValueChange('__none__');
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === '__none__' ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-muted-foreground">{noneLabel}</span>
                  </CommandItem>
                )}
                {sortedAndFilteredFields.map((field) => (
                  <CommandItem
                    key={field}
                    value={field}
                    onSelect={() => {
                      onValueChange(field);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === field ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {getFieldTypeIcon(fieldTypes[field])}
                    <span className="truncate">{field}</span>
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Kompakt versiyon - daha küçük boyutlu seçiciler için
export function CompactSearchableFieldSelect({
  value,
  onValueChange,
  fields,
  fieldTypes = {},
  placeholder = 'Alan...',
  emptyMessage = 'Alan bulunamadı',
  className,
  disabled = false,
  showNoneOption = false,
  noneLabel = 'Seçim yok',
}: SearchableFieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // A-Z sıralı ve filtrelenmiş alanlar
  const sortedAndFilteredFields = useMemo(() => {
    const sorted = [...fields].sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase(), 'tr')
    );
    
    if (!searchQuery) return sorted;
    
    return sorted.filter(field =>
      field.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [fields, searchQuery]);

  const selectedLabel = value && value !== '__none__' 
    ? value 
    : showNoneOption && value === '__none__' 
      ? noneLabel 
      : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-7 text-xs justify-between font-normal min-w-[130px]",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {value && value !== '__none__' && getFieldTypeIcon(fieldTypes[value])}
            <span className="truncate max-w-[100px]">{selectedLabel || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-2">
            <Search className="mr-1.5 h-3 w-3 shrink-0 opacity-50" />
            <input
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-8 w-full rounded-md bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-[160px]">
                {showNoneOption && (
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      onValueChange('__none__');
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-1.5 text-xs py-1.5"
                  >
                    <Check
                      className={cn(
                        "h-3 w-3",
                        value === '__none__' ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-muted-foreground">{noneLabel}</span>
                  </CommandItem>
                )}
                {sortedAndFilteredFields.map((field) => (
                  <CommandItem
                    key={field}
                    value={field}
                    onSelect={() => {
                      onValueChange(field);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-1.5 text-xs py-1.5"
                  >
                    <Check
                      className={cn(
                        "h-3 w-3",
                        value === field ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {getFieldTypeIcon(fieldTypes[field])}
                    <span className="truncate">{field}</span>
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
