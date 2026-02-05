import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useChartColorPalette } from '@/hooks/useChartColorPalette';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { X } from 'lucide-react';

interface DonutChartData {
  name: string;
  value: number;
  tutar?: number; // Opsiyonel tutar alanı - tooltip için
  color?: string;
  fieldKey?: string; // Cross-filter için alan değeri
}

interface DonutChartProps {
  data: DonutChartData[];
  title: string;
  centerLabel?: string;
  centerValue?: string;
  onSegmentClick?: (name: string) => void;
  selectedSegments?: string[];
  isLoading?: boolean;
  colors?: string[];
  widgetId?: string; // Widget bazında palet desteği için
  crossFilterField?: string; // Bu widget hangi global filtre alanını kontrol eder (örn: 'cariKartTipi')
}

export function DonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  onSegmentClick,
  selectedSegments = [],
  isLoading,
  colors: propColors,
  widgetId,
  crossFilterField,
}: DonutChartProps) {
  // Widget bazında palet desteği - widgetId varsa widget-specific palet kullanılır
  const { colors: userColors } = useChartColorPalette({ widgetId });
  const colors = propColors || userColors;
  
  // Global cross-filter state
  const { crossFilter, setCrossFilter, clearCrossFilter } = useGlobalFilters();
  
  // Bu widget'ın cross-filter tarafından etkilenip etkilenmediğini kontrol et
  const isCrossFiltered = useMemo(() => {
    if (!crossFilter || !crossFilterField) return false;
    return crossFilter.field === crossFilterField;
  }, [crossFilter, crossFilterField]);
  
  // Aktif cross-filter değeri
  const activeCrossFilterValue = isCrossFiltered ? crossFilter?.value : null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Cross-filter tıklama handler'ı
  const handleSegmentClick = (entry: DonutChartData) => {
    // Önce mevcut onSegmentClick'i çağır (varsa)
    if (onSegmentClick) {
      onSegmentClick(entry.name);
    }
    
    // Cross-filter aktifse, global filtreyi güncelle
    if (crossFilterField && widgetId) {
      const filterValue = entry.fieldKey || entry.name;
      
      // Aynı değer tıklanırsa filtreyi temizle
      if (activeCrossFilterValue === filterValue) {
        clearCrossFilter();
      } else {
        setCrossFilter({
          sourceWidgetId: widgetId,
          field: crossFilterField,
          value: filterValue,
          label: entry.name,
        });
      }
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = ((item.value / total) * 100).toFixed(1);
      
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 z-50">
          {/* Kategori adı - belirgin */}
          <p className="font-bold text-sm text-foreground mb-1">{item.name}</p>
          
          {/* Değer */}
          <p className="text-lg font-bold text-primary">
            {item.value} Cari
          </p>
          
          {/* Yüzde - belirgin */}
          <p className="text-md font-semibold" style={{ color: item.color || 'hsl(var(--accent))' }}>
            %{percentage}
          </p>
          
          {/* Tutar bilgisi varsa göster */}
          {item.tutar !== undefined && item.tutar > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Toplam: {formatCurrency(item.tutar)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-32 h-32 rounded-full bg-secondary/50 animate-pulse" />
        <p className="mt-2 text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Veri bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[150px]">
      {/* Cross-filter aktif göstergesi */}
      {isCrossFiltered && crossFilter && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-primary/10 border border-primary/30 rounded-t-lg px-2 py-1">
          <span className="text-xs font-medium text-primary truncate">
            Filtre: {crossFilter.label || crossFilter.value}
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              clearCrossFilter();
            }}
            className="p-0.5 hover:bg-primary/20 rounded"
          >
            <X className="h-3 w-3 text-primary" />
          </button>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            cursor={onSegmentClick || crossFilterField ? 'pointer' : 'default'}
            onClick={(entry) => handleSegmentClick(entry)}
          >
            {data.map((entry, index) => {
              const isSelected = selectedSegments.includes(entry.name);
              const isCrossFilterSelected = activeCrossFilterValue === (entry.fieldKey || entry.name);
              const isFiltered = (selectedSegments.length > 0 && !isSelected) || 
                                 (isCrossFiltered && !isCrossFilterSelected);
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || colors[index % colors.length]}
                  opacity={isFiltered ? 0.3 : 1}
                  stroke={isSelected || isCrossFilterSelected ? 'hsl(var(--foreground))' : 'none'}
                  strokeWidth={isSelected || isCrossFilterSelected ? 2 : 0}
                />
              );
            })}
          </Pie>
          <Tooltip 
            content={<CustomTooltip />} 
            wrapperStyle={{ zIndex: 100 }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Label - düşük z-index ile tooltip çakışmasını önle */}
      {(centerLabel || centerValue) && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {centerValue && (
            <p className="text-sm md:text-lg font-bold text-foreground">{centerValue}</p>
          )}
          {centerLabel && (
            <p className="text-[10px] md:text-xs text-muted-foreground">{centerLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
