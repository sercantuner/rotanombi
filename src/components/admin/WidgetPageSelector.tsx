// WidgetCategorySelector - Widget kategori seçici bileşeni
// Widget'ın kategorisini belirler (sayfa seçimi kaldırıldı)
// Dinamik kategoriler desteği + Kategori seçimi için büyüteç modal

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Folder, Loader2, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useWidgetCategories, WidgetCategory as DbWidgetCategory } from '@/hooks/useWidgetCategories';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CategoryPickerModal } from './CategoryPickerModal';

interface WidgetPageSelectorProps {
  // Kategori seçimi için (artık ana işlev)
  selectedCategory?: string;
  onCategoryChange?: (categorySlug: string) => void;
  className?: string;
}

// Dinamik ikon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Folder className={className} />;
  return <Icon className={className} />;
};

export function WidgetPageSelector({
  selectedCategory,
  onCategoryChange,
  className,
}: WidgetPageSelectorProps) {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Dinamik kategorileri çek
  const { activeCategories, isLoading: isCategoriesLoading } = useWidgetCategories();

  // Seçili kategori objesi
  const currentCategory = useMemo(() => {
    if (!selectedCategory) return null;
    return activeCategories.find(c => c.slug === selectedCategory);
  }, [selectedCategory, activeCategories]);

  if (!onCategoryChange) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs text-muted-foreground">Widget Kategorisi</Label>
      <Button 
        variant="outline" 
        className="w-full justify-between h-9"
        onClick={() => setShowCategoryModal(true)}
        disabled={isCategoriesLoading}
      >
        <span className="flex items-center gap-2">
          {isCategoriesLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Yükleniyor...
            </>
          ) : currentCategory ? (
            <>
              <DynamicIcon iconName={currentCategory.icon || 'Folder'} className="h-4 w-4" />
              {currentCategory.name}
            </>
          ) : (
            <>
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Kategori seçin</span>
            </>
          )}
        </span>
        <Search className="h-4 w-4 text-muted-foreground" />
      </Button>

      {/* Kategori Seçim Modal */}
      <CategoryPickerModal
        open={showCategoryModal}
        onOpenChange={setShowCategoryModal}
        selectedCategory={selectedCategory}
        onSelect={(slug) => onCategoryChange(slug)}
      />
    </div>
  );
}
