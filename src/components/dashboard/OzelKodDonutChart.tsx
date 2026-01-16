import React, { useState, useMemo } from 'react';
import { Tag } from 'lucide-react';
import { DonutChart } from './DonutChart';
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';
import type { DiaCari } from '@/lib/diaClient';

type OzelKodType = 'ozelkod1' | 'ozelkod2' | 'ozelkod3';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

export function OzelKodDonutChart({ cariler, isLoading }: Props) {
  const { filters, toggleArrayFilter } = useDashboardFilters();
  const [selectedType, setSelectedType] = useState<OzelKodType>('ozelkod1');

  const chartData = useMemo(() => {
    const fieldMap: Record<OzelKodType, keyof DiaCari> = {
      ozelkod1: 'ozelkod1kod',
      ozelkod2: 'ozelkod2kod',
      ozelkod3: 'ozelkod3kod',
    };
    
    const field = fieldMap[selectedType];
    const grouped = cariler.reduce((acc, cari) => {
      const key = (cari[field] as string) || 'Tanımsız';
      if (!acc[key]) {
        acc[key] = { name: key, value: 0 };
      }
      acc[key].value += Math.abs(cari.bakiye);
      return acc;
    }, {} as Record<string, { name: string; value: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [cariler, selectedType]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const handleSegmentClick = (name: string) => {
    toggleArrayFilter(selectedType, name);
  };

  const selectedSegments = filters[selectedType] || [];

  const typeLabels: Record<OzelKodType, string> = {
    ozelkod1: 'ÖK1',
    ozelkod2: 'ÖK2',
    ozelkod3: 'ÖK3',
  };

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--success))',
    'hsl(var(--warning))',
    'hsl(var(--destructive))',
    'hsl(220 70% 50%)',
    'hsl(280 70% 50%)',
  ];

  const chartDataWithColors = chartData.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Özel Kod Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {chartData.length} kategori
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type Selector */}
          <div className="flex bg-secondary rounded-lg p-1">
            {(['ozelkod1', 'ozelkod2', 'ozelkod3'] as OzelKodType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  selectedType === type
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-accent-foreground" />
          </div>
        </div>
      </div>

      {/* Chart centered */}
      <div className="flex justify-center mb-4">
        <div className="h-36 w-36">
          <DonutChart
            data={chartDataWithColors}
            title="Özel Kod"
            centerLabel={typeLabels[selectedType]}
            centerValue={formatCurrency(total)}
            onSegmentClick={handleSegmentClick}
            selectedSegments={selectedSegments}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Legend as 2-column grid */}
      <div className="grid grid-cols-2 gap-2">
        {chartDataWithColors.map((item) => {
          const isSelected = selectedSegments.includes(item.name);
          return (
            <div
              key={item.name}
              onClick={() => handleSegmentClick(item.name)}
              className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'bg-primary/20 ring-1 ring-primary'
                  : 'hover:bg-secondary/50'
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs truncate flex-1" title={item.name}>{item.name}</span>
              <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(item.value)}</span>
            </div>
          );
        })}
      </div>

      {/* Selected filter indicator */}
      {selectedSegments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{selectedSegments.length} seçili</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectedSegments.forEach((s) => toggleArrayFilter(selectedType, s));
              }}
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Temizle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}