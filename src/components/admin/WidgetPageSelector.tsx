// WidgetTagSelector - Widget etiket seçici bileşeni
// Widget'ın etiketlerini belirler (çoklu seçim desteği)
// Terminoloji: Kategori yerine Etiket sistemi

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Folder, Loader2, Search, Tag, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useWidgetCategories, WidgetCategory as DbWidgetCategory } from '@/hooks/useWidgetCategories';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CategoryPickerModal } from './CategoryPickerModal';
import { TagPickerModal } from './TagPickerModal';

interface WidgetPageSelectorProps {
  // Eski tek seçim modu (geriye uyumluluk)
  selectedCategory?: string;
  onCategoryChange?: (categorySlug: string) => void;
  // Yeni çoklu etiket modu
  selectedTags?: string[];
  onTagsChange?: (tagSlugs: string[]) => void;
  // Diğer ayarlar
  className?: string;
  multiSelect?: boolean; // Çoklu seçim modu aktif mi?
}

// Dinamik ikon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Tag className={className} />;
  return <Icon className={className} />;
};

export function WidgetPageSelector({
  selectedCategory,
  onCategoryChange,
  selectedTags,
  onTagsChange,
  className,
  multiSelect = false,
}: WidgetPageSelectorProps) {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  
  // Dinamik etiketleri çek
  const { activeCategories, isLoading: isCategoriesLoading } = useWidgetCategories();

  // Seçili etiket objeleri
  const currentCategory = useMemo(() => {
    if (!selectedCategory) return null;
    return activeCategories.find(c => c.slug === selectedCategory);
  }, [selectedCategory, activeCategories]);

  const currentTags = useMemo(() => {
    if (!selectedTags || selectedTags.length === 0) return [];
    return activeCategories.filter(c => selectedTags.includes(c.slug));
  }, [selectedTags, activeCategories]);

  // Çoklu seçim modu
  if (multiSelect && onTagsChange) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label className="text-xs text-muted-foreground">Widget Etiketleri</Label>
        <Button 
          variant="outline" 
          className="w-full justify-between h-auto min-h-9 py-2"
          onClick={() => setShowTagsModal(true)}
          disabled={isCategoriesLoading}
        >
          <span className="flex items-center gap-2 flex-wrap">
            {isCategoriesLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : currentTags.length > 0 ? (
              currentTags.map(tag => (
                <Badge key={tag.slug} variant="secondary" className="gap-1">
                  <DynamicIcon iconName={tag.icon || 'Tag'} className="h-3 w-3" />
                  {tag.name}
                </Badge>
              ))
            ) : (
              <>
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Etiket seçin</span>
              </>
            )}
          </span>
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>

        {/* Çoklu Etiket Seçim Modal */}
        <TagPickerModal
          open={showTagsModal}
          onOpenChange={setShowTagsModal}
          selectedTags={selectedTags}
          onSelect={(slugs) => onTagsChange(slugs)}
        />
      </div>
    );
  }

  // Tek seçim modu (geriye uyumluluk)
  if (!onCategoryChange) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs text-muted-foreground">Widget Etiketi</Label>
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
              <DynamicIcon iconName={currentCategory.icon || 'Tag'} className="h-4 w-4" />
              {currentCategory.name}
            </>
          ) : (
            <>
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Etiket seçin</span>
            </>
          )}
        </span>
        <Search className="h-4 w-4 text-muted-foreground" />
      </Button>

      {/* Etiket Seçim Modal */}
      <CategoryPickerModal
        open={showCategoryModal}
        onOpenChange={setShowCategoryModal}
        selectedCategory={selectedCategory}
        onSelect={(slug) => onCategoryChange(slug)}
      />
    </div>
  );
}

// Alias export
export { WidgetPageSelector as WidgetTagSelector };

