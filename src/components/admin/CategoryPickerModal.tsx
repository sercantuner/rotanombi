// CategoryPickerModal - Kategori seçimi için tam ekran modal
// Tüm kategorileri listeleyerek seçim yapmaya olanak sağlar

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWidgetCategories, WidgetCategory } from '@/hooks/useWidgetCategories';
import { Search, Folder, Check, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory?: string;
  onSelect: (categorySlug: string) => void;
}

// Dinamik ikon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Folder className={className} />;
  return <Icon className={className} />;
};

export function CategoryPickerModal({
  open,
  onOpenChange,
  selectedCategory,
  onSelect,
}: CategoryPickerModalProps) {
  const { categories, isLoading } = useWidgetCategories();
  const [searchTerm, setSearchTerm] = useState('');

  // Kategorileri filtrele
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term) ||
      cat.slug.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term)
    );
  }, [categories, searchTerm]);

  const handleSelect = (category: WidgetCategory) => {
    onSelect(category.slug);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Kategori Seç
          </DialogTitle>
          <DialogDescription>
            Widget'ı atamak istediğiniz kategoriyi seçin
          </DialogDescription>
        </DialogHeader>

        {/* Arama */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kategori ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Kategori Listesi */}
        <ScrollArea className="h-[320px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Yükleniyor...</span>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Folder className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz kategori yok'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredCategories.map((category) => {
                const isSelected = selectedCategory === category.slug;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleSelect(category)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary-foreground/20" : "bg-muted"
                    )}>
                      <DynamicIcon 
                        iconName={category.icon || 'Folder'} 
                        className="h-5 w-5"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className={cn(
                          "text-xs truncate",
                          isSelected ? "opacity-80" : "text-muted-foreground"
                        )}>
                          {category.description}
                        </div>
                      )}
                    </div>

                    {!category.is_active && (
                      <Badge variant="outline" className="text-[10px]">
                        Pasif
                      </Badge>
                    )}

                    {isSelected && (
                      <Check className="h-5 w-5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{filteredCategories.length} kategori</span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
