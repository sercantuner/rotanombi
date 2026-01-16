import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

export function CariDonusumTrend({ cariler, isLoading }: Props) {
  // Simüle trend verisi - gerçek veri API'den gelecek
  const trendData = useMemo(() => {
    // Son 12 ay için trend oluştur
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const currentMonth = new Date().getMonth();
    
    // Cari sayısından baz değer hesapla
    const baseCari = Math.max(cariler.length, 10);
    
    return months.map((month, index) => {
      // Son 6 aya kadar gerçekçi artış göster
      const monthIndex = (currentMonth - 11 + index + 12) % 12;
      const growthFactor = 1 + (index * 0.08); // %8 aylık büyüme
      const randomVariance = 0.9 + Math.random() * 0.2; // %10 rastgele varyans
      
      const yeniCari = Math.round((baseCari / 12) * growthFactor * randomVariance);
      const donusumOrani = Math.min(95, 45 + index * 4 + Math.random() * 10);
      
      return {
        month,
        yeniCari,
        donusumOrani: Math.round(donusumOrani),
        toplamCari: Math.round(baseCari * (index + 1) / 12),
      };
    });
  }, [cariler.length]);

  const formatNumber = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'donusumOrani' ? 'Dönüşüm Oranı' : 'Yeni Cari'}:{' '}
              <span className="font-bold">
                {entry.name === 'donusumOrani' ? `%${entry.value}` : entry.value}
              </span>
            </p>
          ))}
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
            <h3 className="text-lg font-semibold">Cari Dönüşüm Trendi</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="h-56 bg-secondary/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  const lastMonth = trendData[trendData.length - 1];
  const prevMonth = trendData[trendData.length - 2];
  const donusumChange = lastMonth.donusumOrani - prevMonth.donusumOrani;

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Cari Dönüşüm Trendi</h3>
          <p className="text-sm text-muted-foreground">
            Aylık yeni cari ve dönüşüm oranı
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">%{lastMonth.donusumOrani}</p>
            <p className={`text-xs ${donusumChange >= 0 ? 'text-success' : 'text-destructive'}`}>
              {donusumChange >= 0 ? '+' : ''}{donusumChange}% ay
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span className="text-muted-foreground">Yeni Cari</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-success" />
          <span className="text-muted-foreground">Dönüşüm Oranı (%)</span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorYeniCari" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDonusum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="yeniCari"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorYeniCari)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="donusumOrani"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              fill="url(#colorDonusum)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
