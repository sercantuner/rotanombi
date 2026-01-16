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
      .slice(0, 8);
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

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Özel Kod Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {chartData.length} kategori · Tıklayarak filtrele
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type Selector */}
          <div className="flex bg-secondary rounded-lg p-1">
            {(['ozelkod1', 'ozelkod2', 'ozelkod3'] as OzelKodType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
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

      <div className="flex gap-4">
        {/* Donut Chart */}
        <div className="h-48 w-48 flex-shrink-0">
          <DonutChart
            data={chartData}
            title="Özel Kod"
            centerLabel={typeLabels[selectedType]}
            centerValue={formatCurrency(total)}
            onSegmentClick={handleSegmentClick}
            selectedSegments={selectedSegments}
            isLoading={isLoading}
          />
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-48">
          {chartData.map((item, index) => {
            const isSelected = selectedSegments.includes(item.name);
            const colors = [
              'bg-primary',
              'bg-success',
              'bg-warning',
              'bg-destructive',
              'bg-blue-500',
              'bg-purple-500',
              'bg-teal-500',
              'bg-pink-500',
            ];
            return (
              <div
                key={item.name}
                onClick={() => handleSegmentClick(item.name)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary/20 border border-primary'
                    : 'hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${colors[index % colors.length]}`} />
                  <span className="text-sm truncate max-w-[120px]">{item.name}</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(item.value)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected filter indicator */}
      {selectedSegments.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
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
