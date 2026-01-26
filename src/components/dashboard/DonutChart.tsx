import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useChartColorPalette } from '@/hooks/useChartColorPalette';

interface DonutChartData {
  name: string;
  value: number;
  tutar?: number; // Opsiyonel tutar alanı - tooltip için
  color?: string;
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
}: DonutChartProps) {
  // Kullanıcının seçtiği paleti kullan
  const { colors: userColors } = useChartColorPalette();
  const colors = propColors || userColors;
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);

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
            cursor={onSegmentClick ? 'pointer' : 'default'}
            onClick={(entry) => onSegmentClick?.(entry.name)}
          >
            {data.map((entry, index) => {
              const isSelected = selectedSegments.includes(entry.name);
              const isFiltered = selectedSegments.length > 0 && !isSelected;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || colors[index % colors.length]}
                  opacity={isFiltered ? 0.3 : 1}
                  stroke={isSelected ? 'hsl(var(--foreground))' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
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
