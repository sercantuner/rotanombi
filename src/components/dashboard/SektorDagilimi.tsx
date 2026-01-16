import React, { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { DonutChart } from './DonutChart';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

export function SektorDagilimi({ cariler, isLoading }: Props) {
  // Sektör bilgisi ozelkod1'den geldiğini varsayıyoruz
  const chartData = useMemo(() => {
    const grouped = cariler.reduce((acc, cari) => {
      // Sektör bilgisi için ozelkod1 kullanılıyor
      const sektor = cari.ozelkod1kod || 'Diğer';
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

      <div className="flex gap-4">
        {/* Donut Chart */}
        <div className="h-40 w-40 flex-shrink-0">
          <DonutChart
            data={chartDataWithColors}
            title="Sektör"
            centerLabel="Toplam"
            centerValue={formatCurrency(total)}
            isLoading={isLoading}
          />
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-40">
          {chartDataWithColors.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm truncate max-w-[100px]">{item.name}</span>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
