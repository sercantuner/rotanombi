import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DonutChartData {
  name: string;
  value: number;
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

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(220 70% 50%)',
  'hsl(280 70% 50%)',
  'hsl(180 70% 50%)',
  'hsl(320 70% 50%)',
];

export function DonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  onSegmentClick,
  selectedSegments = [],
  isLoading,
  colors = DEFAULT_COLORS,
}: DonutChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm">{item.name}</p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(item.value)}
          </p>
          <p className="text-xs text-muted-foreground">
            {((item.value / total) * 100).toFixed(1)}%
          </p>
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
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
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
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Label */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <p className="text-lg font-bold text-foreground">{centerValue}</p>
          )}
          {centerLabel && (
            <p className="text-xs text-muted-foreground">{centerLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
