// Widget Wrapper - Widget sarmalayıcı bileşen
// Her widget'ı saran konteyner, ayarlar ve kaldırma butonları içerir

import React, { useState } from 'react';
import { Settings, X, MoveRight, Filter, RotateCcw, Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { WidgetSettingsModal } from './WidgetSettingsModal';
import { WidgetFeedbackButton } from './WidgetFeedbackButton';
import { getWidgetById, WidgetCategory, getPageCategories } from '@/lib/widgetRegistry';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useChartColorPalette, COLOR_PALETTES } from '@/hooks/useChartColorPalette';

interface WidgetWrapperProps {
  widgetId: string;
  widgetDbId?: string; // Veritabanındaki UUID (feedback için)
  widgetName?: string;
  currentPage: WidgetCategory;
  children: React.ReactNode;
  className?: string;
  showControls?: boolean;
}

export function WidgetWrapper({ 
  widgetId, 
  widgetDbId,
  widgetName,
  currentPage, 
  children, 
  className = '',
  showControls = true,
}: WidgetWrapperProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { removeWidgetFromPage, moveWidgetToPage, getWidgetFilters, resetWidgetFilters } = useUserSettings();
  const { currentPaletteName, setPalette } = useChartColorPalette();
  
  const widget = getWidgetById(widgetId);
  const filters = getWidgetFilters(widgetId);
  const hasActiveFilters = Object.keys(filters).length > 0;
  const pages = getPageCategories();
  const otherPages = pages.filter(p => p.id !== currentPage);

  if (!widget) {
    return null;
  }

  const handleRemove = async () => {
    await removeWidgetFromPage(widgetId, currentPage);
  };

  const handleMoveTo = async (targetPage: WidgetCategory) => {
    await moveWidgetToPage(widgetId, currentPage, targetPage);
  };

  const handleResetFilters = async () => {
    await resetWidgetFilters(widgetId);
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Control Buttons - Show on hover */}
      {showControls && (
        <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Filter indicator */}
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full bg-primary/20 text-primary font-medium flex items-center gap-0.5 md:gap-1">
              <Filter className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Filtreli</span>
            </span>
          )}

          {/* Feedback button */}
          {widgetDbId && (
            <WidgetFeedbackButton 
              widgetId={widgetDbId} 
              widgetName={widgetName || widget?.name || 'Widget'} 
            />
          )}

          {/* Settings button */}
          {widget.availableFilters.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:h-7 md:w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
          )}

          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 md:h-7 md:w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
              >
                <X className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Color Palette Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Palette className="w-4 h-4" />
                  Renk Paleti
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {COLOR_PALETTES.map(palette => (
                    <DropdownMenuItem
                      key={palette.name}
                      onClick={() => setPalette(palette.name)}
                      className="gap-2"
                    >
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="flex gap-0.5">
                          {palette.colors.slice(0, 4).map((color, i) => (
                            <div
                              key={i}
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-xs">{palette.label}</span>
                      </div>
                      {currentPaletteName === palette.name && (
                        <Check className="w-3 h-3 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              <DropdownMenuSeparator />
              
              {/* Move to another page */}
              {otherPages.map(page => (
                <DropdownMenuItem 
                  key={page.id}
                  onClick={() => handleMoveTo(page.id)}
                  className="gap-2"
                >
                  <MoveRight className="w-4 h-4" />
                  {page.name}'a Taşı
                </DropdownMenuItem>
              ))}
              
              {otherPages.length > 0 && <DropdownMenuSeparator />}
              
              {/* Reset filters */}
              {hasActiveFilters && (
                <DropdownMenuItem onClick={handleResetFilters} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Filtreleri Sıfırla
                </DropdownMenuItem>
              )}
              
              {/* Remove from page */}
              <DropdownMenuItem 
                onClick={handleRemove}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <X className="w-4 h-4" />
                Kaldır
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Widget Content */}
      {children}

      {/* Settings Modal */}
      <WidgetSettingsModal
        widgetId={widgetId}
        currentPage={currentPage}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}
