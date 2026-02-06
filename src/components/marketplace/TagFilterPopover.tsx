// Tag Filter Popover - Marketplace için popover tabanlı etiket filtresi
import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tag, X, Filter, LayoutGrid } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagCategory {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface TagFilterPopoverProps {
  categories: TagCategory[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  tagCounts?: Record<string, number>;
  isLoading?: boolean;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

export function TagFilterPopover({
  categories,
  selectedTags,
  onTagsChange,
  tagCounts = {},
  isLoading = false
}: TagFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Filtrelenmiş kategoriler
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const searchLower = search.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(searchLower) ||
      cat.slug.toLowerCase().includes(searchLower)
    );
  }, [categories, search]);

  // Etiket toggle
  const toggleTag = (slug: string) => {
    if (selectedTags.includes(slug)) {
      onTagsChange(selectedTags.filter(t => t !== slug));
    } else {
      onTagsChange([...selectedTags, slug]);
    }
  };

  // Tümünü temizle
  const clearAll = () => {
    onTagsChange([]);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "gap-2 h-10",
            selectedTags.length > 0 && "border-primary bg-primary/5"
          )}
        >
          <Filter className="h-4 w-4" />
          Etiket Filtrele
          {selectedTags.length > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs ml-1">
              {selectedTags.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Etiket ara..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Etiket bulunamadı</CommandEmpty>
            <CommandGroup>
              {filteredCategories.map(cat => {
                const isSelected = selectedTags.includes(cat.slug);
                const count = tagCounts[cat.slug] || 0;
                
                return (
                  <CommandItem
                    key={cat.id}
                    value={cat.slug}
                    onSelect={() => toggleTag(cat.slug)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={isSelected}
                        className="pointer-events-none"
                      />
                      <DynamicIcon iconName={cat.icon || 'Tag'} className="h-4 w-4 text-muted-foreground" />
                      <span>{cat.name}</span>
                    </div>
                    {count > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {count}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          
          {/* Footer */}
          {selectedTags.length > 0 && (
            <div className="border-t p-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedTags.length} etiket seçili
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={clearAll}
              >
                <X className="h-3 w-3 mr-1" />
                Temizle
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
