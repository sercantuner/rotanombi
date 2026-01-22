// Widget Wrapper - Widget sarmalayıcı bileşen
// Her widget'ı saran konteyner, ayarlar ve kaldırma butonları içerir

import React, { useState } from 'react';
import { Settings, X, MoveRight, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WidgetSettingsModal } from './WidgetSettingsModal';
import { WidgetFeedbackButton } from './WidgetFeedbackButton';
import { getWidgetById, WidgetCategory, getPageCategories } from '@/lib/widgetRegistry';
import { useUserSettings } from '@/contexts/UserSettingsContext';

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
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Filter indicator */}
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filtreli
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
              className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}

          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
              >
                <X className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
