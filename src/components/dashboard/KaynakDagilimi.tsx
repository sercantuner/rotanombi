import React, { useMemo } from 'react';
import { Share2 } from 'lucide-react';
import { DonutChart } from './DonutChart';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

export function KaynakDagilimi({ cariler, isLoading }: Props) {
  // Kaynak bilgisi 'kaynak' alanından geliyor - CARİ SAYISI (value) + TUTAR (tutar)
  const chartData = useMemo(() => {
    const grouped = cariler.reduce((acc, cari) => {
      const kaynak = cari.kaynak || 'Tanımsız';
      if (!acc[kaynak]) {
        acc[kaynak] = { name: kaynak, value: 0, tutar: 0 };
      }
      acc[kaynak].value += 1; // Cari sayısı
      acc[kaynak].tutar += Math.abs(cari.bakiye); // Toplam tutar
      return acc;
    }, {} as Record<string, { name: string; value: number; tutar: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.value - a.value) // Cari sayısına göre sırala
      .slice(0, 6);
  }, [cariler]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const totalCount = chartData.reduce((sum, item) => sum + item.value, 0);

  const COLORS = [
    'hsl(280 70% 50%)',
    'hsl(320 70% 50%)',
    'hsl(180 70% 50%)',
    'hsl(142 76% 46%)',
    'hsl(38 92% 50%)',
    'hsl(220 70% 50%)',
  ];

  const chartDataWithColors = chartData.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Kaynak Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {chartData.length} kaynak
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Share2 className="w-5 h-5 text-purple-500" />
        </div>
      </div>

      {/* Chart centered */}
      <div className="flex justify-center mb-4">
        <div className="h-36 w-36">
          <DonutChart
            data={chartDataWithColors}
            title="Kaynak"
            centerLabel="Cari"
            centerValue={`${totalCount}`}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Legend as 2-column grid - showing count */}
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
            <span className="text-xs font-semibold text-muted-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
