// Filtrelenebilir KPI Kartı
// StatCard'ın filtre ikonu eklenmiş versiyonu

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Filter, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiFilterModal, KpiFilter } from './KpiFilterModal';
import { cn } from '@/lib/utils';

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
}: FilterableStatCardProps) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  
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

  const TrendIcon = trendIcons[trend];
  const hasActiveFilters = currentFilters && (
    currentFilters.gorunumModu !== 'hepsi' ||
    currentFilters.durum !== 'hepsi' ||
    currentFilters.cariKartTipi.length !== 3 ||
    currentFilters.ozelKod1 ||
    currentFilters.ozelKod2 ||
    currentFilters.ozelKod3
  );

  // Filtre butonunu göster koşulu
  const canShowFilterButton = showFilterButton && onFiltersChange;

  return (
    <>
      <div className="stat-card animate-slide-up group relative">
        {/* Filter Button - Hover'da görünür */}
        {canShowFilterButton && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10',
              hasActiveFilters && 'opacity-100 bg-primary/10 text-primary'
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

        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <p className="metric-label mb-1">{title}</p>
            <p className={`metric-value ${variantStyles[variant]}`}>{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-secondary ${variantStyles[variant]} flex-shrink-0`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        
        {trendValue && (
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
    </>
  );
}
