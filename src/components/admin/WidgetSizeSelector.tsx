// WidgetSizeSelector - Görsel boyut seçici bileşeni
// Çoklu boyut seçimi destekler, varsayılan boyut belirlenebilir

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Star } from 'lucide-react';
import { WidgetSize, WIDGET_SIZES } from '@/lib/widgetTypes';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WidgetSizeSelectorProps {
  selectedSizes: WidgetSize[];
  defaultSize: WidgetSize;
  onChange: (sizes: WidgetSize[], defaultSize: WidgetSize) => void;
  className?: string;
}

export function WidgetSizeSelector({
  selectedSizes,
  defaultSize,
  onChange,
  className,
}: WidgetSizeSelectorProps) {
  const handleSizeClick = (sizeId: WidgetSize) => {
    const isSelected = selectedSizes.includes(sizeId);
    
    if (isSelected) {
      // Boyut zaten seçili - kaldır (ama en az 1 boyut kalmalı)
      if (selectedSizes.length > 1) {
        const newSizes = selectedSizes.filter(s => s !== sizeId);
        // Eğer varsayılan boyut kaldırılıyorsa, yeni varsayılanı ilk seçili boyut yap
        const newDefaultSize = sizeId === defaultSize ? newSizes[0] : defaultSize;
        onChange(newSizes, newDefaultSize);
      }
    } else {
      // Boyut seçili değil - ekle
      onChange([...selectedSizes, sizeId], defaultSize);
    }
  };

  const handleSetDefault = (sizeId: WidgetSize, e: React.MouseEvent) => {
    e.stopPropagation();
    // Sadece seçili boyutlardan biri varsayılan olabilir
    if (selectedSizes.includes(sizeId)) {
      onChange(selectedSizes, sizeId);
    }
  };

  // Görsel boyut önizleme için genişlik oranları
  const getSizePreviewWidth = (sizeId: WidgetSize): string => {
    switch (sizeId) {
      case 'sm': return 'w-8';
      case 'md': return 'w-14';
      case 'lg': return 'w-20';
      case 'xl': return 'w-28';
      case 'full': return 'w-full';
      default: return 'w-14';
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-1 flex-wrap">
          {WIDGET_SIZES.map((size) => {
            const isSelected = selectedSizes.includes(size.id);
            const isDefault = defaultSize === size.id;
            
            return (
              <Tooltip key={size.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleSizeClick(size.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all min-w-[60px]",
                      isSelected 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-muted-foreground/50 bg-background",
                      isDefault && "ring-2 ring-yellow-500/50"
                    )}
                  >
                    {/* Boyut önizleme kutusu */}
                    <div className="h-6 flex items-end justify-center w-full">
                      <div 
                        className={cn(
                          "h-5 rounded-sm transition-all",
                          getSizePreviewWidth(size.id),
                          isSelected ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                    </div>
                    
                    {/* Boyut etiketi */}
                    <span className={cn(
                      "text-[10px] font-medium uppercase",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}>
                      {size.id}
                    </span>
                    
                    {/* Kolon sayısı */}
                    <span className="text-[9px] text-muted-foreground">
                      {size.cols} kol
                    </span>
                    
                    {/* Seçim işareti */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    
                    {/* Varsayılan yıldız */}
                    {isDefault && isSelected && (
                      <button
                        type="button"
                        onClick={(e) => handleSetDefault(size.id, e)}
                        className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-yellow-500 flex items-center justify-center"
                      >
                        <Star className="h-2.5 w-2.5 text-white fill-white" />
                      </button>
                    )}
                    
                    {/* Varsayılan yapma butonu (seçili ama varsayılan değilse) */}
                    {isSelected && !isDefault && (
                      <button
                        type="button"
                        onClick={(e) => handleSetDefault(size.id, e)}
                        className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <Star className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{size.name}</p>
                  <p className="text-muted-foreground">{size.cols} kolon genişlik</p>
                  {isDefault && <p className="text-yellow-500">★ Varsayılan boyut</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        
        <p className="text-[10px] text-muted-foreground">
          Tıklayarak boyut ekle/kaldır. ★ = varsayılan boyut (tıkla değiştir)
        </p>
      </div>
    </TooltipProvider>
  );
}
