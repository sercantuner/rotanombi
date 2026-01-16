import React, { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { DonutChart } from './DonutChart';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

export function SektorDagilimi({ cariler, isLoading }: Props) {
  // Sektör bilgisi 'sektorler' alanından geliyor
  const chartData = useMemo(() => {
    const grouped = cariler.reduce((acc, cari) => {
      // Sektör bilgisi için sektorler alanı kullanılıyor
      const sektor = cari.sektorler || 'Tanımsız';
      if (!acc[sektor]) {
        acc[sektor] = { name: sektor, value: 0 };
      }
      acc[sektor].value += Math.abs(cari.bakiye);
      return acc;
    }, {} as Record<string, { name: string; value: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [cariler]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const COLORS = [
    'hsl(220 70% 50%)',
    'hsl(142 76% 46%)',
    'hsl(38 92% 50%)',
    'hsl(0 84% 60%)',
    'hsl(280 70% 50%)',
    'hsl(180 70% 50%)',
  ];

  const chartDataWithColors = chartData.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Sektör Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {chartData.length} sektör
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {/* Chart centered */}
      <div className="flex justify-center mb-4">
        <div className="h-36 w-36">
          <DonutChart
            data={chartDataWithColors}
            title="Sektör"
            centerLabel="Toplam"
            centerValue={formatCurrency(total)}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Legend as 2-column grid */}
      <div className="grid grid-cols-2 gap-2">
        {chartDataWithColors.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/50"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs truncate flex-1" title={item.name}>{item.name}</span>
            <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}