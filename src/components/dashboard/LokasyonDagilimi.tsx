import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

export function LokasyonDagilimi({ cariler, isLoading }: Props) {
  const { filters, toggleArrayFilter } = useDashboardFilters();

  const chartData = useMemo(() => {
    const grouped = cariler.reduce((acc, cari) => {
      const sehir = cari.sehir || 'Bilinmiyor';
      if (!acc[sehir]) {
        acc[sehir] = { name: sehir, value: 0, count: 0 };
      }
      acc[sehir].value += Math.abs(cari.bakiye);
      acc[sehir].count += 1;
      return acc;
    }, {} as Record<string, { name: string; value: number; count: number }>);

    // Cari sayısına göre sırala (bakiye yerine)
    return Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [cariler]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const formatFullCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const handleBarClick = (data: any) => {
    if (data && data.name) {
      toggleArrayFilter('sehir', data.name);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm">{data.name}</p>
          <p className="text-lg font-bold text-primary">{data.count} cari</p>
          <p className="text-xs text-muted-foreground">Toplam: {formatFullCurrency(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Lokasyon Dağılımı</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="h-56 bg-secondary/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Lokasyon Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {chartData.length} şehir · Cari sayısına göre · Tıklayarak filtrele
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-teal-500" />
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => value.toString()}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              label={{ value: 'Cari Sayısı', position: 'bottom', offset: -5, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(data) => handleBarClick(data)}
            >
              {chartData.map((entry, index) => {
                const isSelected = filters.sehir.includes(entry.name);
                const isFiltered = filters.sehir.length > 0 && !isSelected;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill="hsl(var(--primary))"
                    opacity={isFiltered ? 0.3 : 1}
                    stroke={isSelected ? 'hsl(var(--foreground))' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Selected filter indicator */}
      {filters.sehir.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{filters.sehir.length} şehir seçili</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                filters.sehir.forEach((s) => toggleArrayFilter('sehir', s));
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
