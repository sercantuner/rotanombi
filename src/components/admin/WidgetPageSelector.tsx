// WidgetPageSelector - Multi-select sayfa seçici bileşeni
// Widget'ın hangi sayfalarda görüneceğini belirler

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Plus, X, Star, LayoutDashboard, TrendingUp, Wallet, Users } from 'lucide-react';
import { WidgetCategory, PAGE_CATEGORIES } from '@/lib/widgetTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  className?: string;
}

// Sayfa ikonları
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
  className,
}: WidgetPageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePageToggle = (pageId: WidgetCategory) => {
    const isSelected = selectedPages.includes(pageId);
    
    if (isSelected) {
      // Sayfa zaten seçili - kaldır (ama en az 1 sayfa kalmalı)
      if (selectedPages.length > 1) {
        const newPages = selectedPages.filter(p => p !== pageId);
        // Eğer varsayılan sayfa kaldırılıyorsa, yeni varsayılanı ilk seçili sayfa yap
        const newDefaultPage = pageId === defaultPage ? newPages[0] : defaultPage;
        onChange(newPages, newDefaultPage);
      }
    } else {
      // Sayfa seçili değil - ekle
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
  const availablePages = PAGE_CATEGORIES.filter(p => !selectedPages.includes(p.id));

  return (
    <TooltipProvider>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Seçili sayfalar */}
          {selectedPages.map((pageId) => {
            const page = PAGE_CATEGORIES.find(p => p.id === pageId);
            const Icon = PAGE_ICONS[pageId] || LayoutDashboard;
            const isDefault = pageId === defaultPage;
            
            if (!page) return null;
            
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
                    <Icon className="h-3 w-3" />
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
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sayfa Ekle</p>
                  {availablePages.map((page) => {
                    const Icon = PAGE_ICONS[page.id] || LayoutDashboard;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => {
                          handlePageToggle(page.id);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{page.name}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          ★ = varsayılan sayfa. Widget ilk bu sayfada görünür.
        </p>
      </div>
    </TooltipProvider>
  );
}
