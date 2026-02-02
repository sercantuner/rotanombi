// WidgetPageSelector - Multi-select sayfa seçici bileşeni
// Widget'ın hangi sayfalarda görüneceğini belirler
// Dinamik kategoriler desteği eklendi

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, Plus, X, Star, LayoutDashboard, TrendingUp, Wallet, Users, Folder, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { WidgetCategory, PAGE_CATEGORIES } from '@/lib/widgetTypes';
import { useWidgetCategories, WidgetCategory as DbWidgetCategory } from '@/hooks/useWidgetCategories';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WidgetPageSelectorProps {
  selectedPages: WidgetCategory[];
  defaultPage: WidgetCategory;
  onChange: (pages: WidgetCategory[], defaultPage: WidgetCategory) => void;
  // Yeni: Kategori seçimi için
  selectedCategory?: string;
  onCategoryChange?: (categorySlug: string) => void;
  showCategorySelector?: boolean;
  className?: string;
}

// Dinamik ikon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Folder className={className} />;
  return <Icon className={className} />;
};

// Eski sayfa ikonları (fallback)
const PAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  satis: TrendingUp,
  finans: Wallet,
  cari: Users,
};

export function WidgetPageSelector({
  selectedPages,
  defaultPage,
  onChange,
  selectedCategory,
  onCategoryChange,
  showCategorySelector = true,
  className,
}: WidgetPageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  
  // Dinamik kategorileri çek
  const { activeCategories, isLoading: isCategoriesLoading } = useWidgetCategories();
  
  // Birleştirilmiş sayfa listesi: Dinamik kategoriler + eski sabit sayfalar
  const allPages = useMemo(() => {
    // Önce dinamik kategorileri ekle
    const dynamicPages = activeCategories.map(cat => ({
      id: cat.slug as WidgetCategory,
      name: cat.name,
      icon: cat.icon || 'Folder',
      isDynamic: true,
    }));
    
    // Eski sabit sayfaları ekle (eğer dinamik olarak eklenmemişse)
    const staticPages = PAGE_CATEGORIES
      .filter(p => !dynamicPages.some(dp => dp.id === p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        icon: PAGE_ICONS[p.id] ? p.id : 'Folder',
        isDynamic: false,
      }));
    
    return [...dynamicPages, ...staticPages];
  }, [activeCategories]);

  // Seçili kategori objesi
  const currentCategory = useMemo(() => {
    if (!selectedCategory) return null;
    return activeCategories.find(c => c.slug === selectedCategory);
  }, [selectedCategory, activeCategories]);

  const handlePageToggle = (pageId: WidgetCategory) => {
    const isSelected = selectedPages.includes(pageId);
    
    if (isSelected) {
      if (selectedPages.length > 1) {
        const newPages = selectedPages.filter(p => p !== pageId);
        const newDefaultPage = pageId === defaultPage ? newPages[0] : defaultPage;
        onChange(newPages, newDefaultPage);
      }
    } else {
      onChange([...selectedPages, pageId], defaultPage);
    }
  };

  const handleSetDefault = (pageId: WidgetCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedPages.includes(pageId)) {
      onChange(selectedPages, pageId);
    }
  };

  const handleRemove = (pageId: WidgetCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedPages.length > 1) {
      const newPages = selectedPages.filter(p => p !== pageId);
      const newDefaultPage = pageId === defaultPage ? newPages[0] : defaultPage;
      onChange(newPages, newDefaultPage);
    }
  };

  // Seçili olmayan sayfalar
  const availablePages = allPages.filter(p => !selectedPages.includes(p.id));

  // Sayfa için ikon al
  const getPageIcon = (pageId: string, iconName?: string) => {
    if (iconName && iconName !== pageId) {
      return <DynamicIcon iconName={iconName} className="h-3 w-3" />;
    }
    const StaticIcon = PAGE_ICONS[pageId] || Folder;
    return <StaticIcon className="h-3 w-3" />;
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-3", className)}>
        {/* Kategori Seçici */}
        {showCategorySelector && onCategoryChange && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Widget Kategorisi</Label>
            <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-9"
                  disabled={isCategoriesLoading}
                >
                  {isCategoriesLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Yükleniyor...
                    </>
                  ) : currentCategory ? (
                    <>
                      <DynamicIcon iconName={currentCategory.icon || 'Folder'} className="h-4 w-4 mr-2" />
                      {currentCategory.name}
                    </>
                  ) : (
                    <>
                      <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-muted-foreground">Kategori seçin</span>
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Kategori Seç ({activeCategories.length})
                  </p>
                  {activeCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        onCategoryChange(category.slug);
                        setIsCategoryOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        selectedCategory === category.slug
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <DynamicIcon iconName={category.icon || 'Folder'} className="h-4 w-4" />
                      <span className="flex-1 text-left">{category.name}</span>
                      {selectedCategory === category.slug && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                  
                  {activeCategories.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Henüz kategori tanımlanmamış
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showCategorySelector && onCategoryChange && <Separator />}

        {/* Hedef Sayfalar */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Hedef Sayfalar</Label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Seçili sayfalar */}
            {selectedPages.map((pageId) => {
              const page = allPages.find(p => p.id === pageId);
              const isDefault = pageId === defaultPage;
              
              if (!page) {
                // Sayfa bulunamadıysa basit badge göster
                return (
                  <Badge key={pageId} variant="secondary" className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    <span>{pageId}</span>
                  </Badge>
                );
              }
              
              return (
                <Tooltip key={pageId}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={isDefault ? "default" : "secondary"}
                      className={cn(
                        "flex items-center gap-1 pr-1 cursor-pointer transition-all",
                        isDefault && "bg-primary"
                      )}
                    >
                      {isDefault && <Star className="h-2.5 w-2.5 fill-current" />}
                      {getPageIcon(page.id, page.icon)}
                      <span>{page.name}</span>
                      
                      {/* Varsayılan yap butonu */}
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleSetDefault(pageId, e)}
                          className="ml-0.5 h-4 w-4 rounded-full hover:bg-foreground/10 flex items-center justify-center"
                        >
                          <Star className="h-2.5 w-2.5" />
                        </button>
                      )}
                      
                      {/* Kaldır butonu */}
                      {selectedPages.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleRemove(pageId, e)}
                          className="ml-0.5 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {isDefault ? "★ Varsayılan sayfa" : "Tıkla varsayılan yap"}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Ekle butonu */}
            {availablePages.length > 0 && (
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Ekle
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Sayfa Ekle ({availablePages.length})
                    </p>
                    {availablePages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => {
                          handlePageToggle(page.id);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm transition-colors"
                      >
                        {getPageIcon(page.id, page.icon)}
                        <span>{page.name}</span>
                        {page.isDynamic && (
                          <Badge variant="outline" className="ml-auto text-[10px] h-4">
                            Dinamik
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            ★ = varsayılan sayfa. Widget ilk bu sayfada görünür.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
