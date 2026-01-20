// Filtrelenebilir KPI Kartı
// StatCard'ın filtre ve ayar ikonu eklenmiş versiyonu

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Filter, FilterX, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiFilterModal, KpiFilter } from './KpiFilterModal';
import { KpiSettingsModal, KpiSettings, DEFAULT_KPI_SETTINGS } from './KpiSettingsModal';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface FilterableStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  // Filter props
  widgetId: string;
  widgetKey: string;
  containerWidgetId?: string;
  currentFilters?: KpiFilter;
  onFiltersChange?: (filters: KpiFilter) => void;
  showFilterButton?: boolean;
  // Widget düzenleme modu
  isWidgetEditMode?: boolean;
}

export function FilterableStatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend = 'neutral',
  trendValue,
  variant = 'default',
  widgetId,
  widgetKey,
  containerWidgetId,
  currentFilters,
  onFiltersChange,
  showFilterButton = true,
  isWidgetEditMode = false,
}: FilterableStatCardProps) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [kpiSettings, setKpiSettings] = useState<KpiSettings>(DEFAULT_KPI_SETTINGS);

  // KPI settings'i yükle
  useEffect(() => {
    const loadSettings = async () => {
      if (!containerWidgetId) return;
      
      const { data } = await supabase
        .from('container_widgets')
        .select('settings')
        .eq('id', containerWidgetId)
        .single();
      
      if (data?.settings && (data.settings as any).kpiSettings) {
        setKpiSettings((data.settings as any).kpiSettings);
      }
    };
    
    loadSettings();
  }, [containerWidgetId]);
  
  const variantStyles = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  };

  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  const fontSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const TrendIcon = trendIcons[trend];
  const hasActiveFilters = currentFilters && (
    currentFilters.gorunumModu !== 'hepsi' ||
    currentFilters.durum !== 'hepsi' ||
    currentFilters.cariKartTipi.length !== 3 ||
    currentFilters.ozelKod1 ||
    currentFilters.ozelKod2 ||
    currentFilters.ozelKod3
  );

  // Filtre ve ayar butonlarını göster koşulu
  const canShowFilterButton = showFilterButton && onFiltersChange;
  const canShowSettingsButton = !!containerWidgetId;

  return (
    <>
      <div className="stat-card animate-slide-up group relative h-full min-h-0 flex flex-col overflow-hidden">
        {/* Control Buttons - Sadece düzenleme modunda görünür */}
        <div className={cn(
          'absolute top-2 right-2 flex items-center gap-1 z-10 transition-opacity',
          isWidgetEditMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          {/* Settings Button */}
          {canShowSettingsButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-background/60 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                setSettingsModalOpen(true);
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          
          {/* Filter Button */}
          {canShowFilterButton && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 bg-background/60 backdrop-blur-sm hover:bg-background',
                hasActiveFilters && 'bg-primary/10 text-primary'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setFilterModalOpen(true);
              }}
            >
              {hasActiveFilters ? (
                <FilterX className="h-4 w-4" />
              ) : (
                <Filter className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        <div className="flex items-start justify-between flex-1 min-w-0">
          <div className="flex-1 min-w-0 pr-2">
            <p className="metric-label mb-1 truncate">{title}</p>
            <p className={cn(
              'metric-value truncate',
              variantStyles[variant],
              fontSizeClasses[kpiSettings.fontSize]
            )}>
              {value}
            </p>
            {subtitle && kpiSettings.showSubtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {/* İkon - küçük ekranlarda gizlenir */}
          {kpiSettings.showIcon && (
            <div className={cn(
              "p-2 md:p-3 rounded-lg bg-secondary flex-shrink-0 hidden sm:flex items-center justify-center",
              variantStyles[variant]
            )}>
              <Icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          )}
        </div>
        
        {trendValue && kpiSettings.showTrend && (
          <div className={`flex items-center gap-1 mt-3 text-sm ${trendColors[trend]}`}>
            <TrendIcon className="w-4 h-4" />
            <span>{trendValue}</span>
          </div>
        )}

        {/* Aktif filtre göstergesi */}
        {hasActiveFilters && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-primary/70">
            <Filter className="h-3 w-3" />
            <span>Filtreli</span>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <KpiFilterModal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        widgetId={widgetId}
        widgetName={title}
        containerWidgetId={containerWidgetId}
        currentFilters={currentFilters}
        onFiltersChange={onFiltersChange}
      />

      {/* Settings Modal */}
      <KpiSettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        containerWidgetId={containerWidgetId}
        widgetName={title}
        currentSettings={kpiSettings}
        onSettingsChange={setKpiSettings}
      />
    </>
  );
}
