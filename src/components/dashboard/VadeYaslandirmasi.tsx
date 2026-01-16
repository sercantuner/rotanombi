import React, { useState, useMemo } from 'react';
import { Clock, AlertTriangle, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { VadeYaslandirma } from '@/lib/diaClient';
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';

interface Props {
  yaslandirma: VadeYaslandirma;
  isLoading?: boolean;
}

type Periyot = 'gunluk' | 'haftalik' | 'aylik';

export function VadeYaslandirmasi({ yaslandirma, isLoading }: Props) {
  const { filters, setFilter } = useDashboardFilters();
  const [periyot, setPeriyot] = useState<Periyot>('gunluk');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `₺${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const formatFullCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Periyota göre chart data hesapla
  const { chartData, toplam, gecmisToplam, gelecekToplam } = useMemo(() => {
    if (periyot === 'gunluk') {
      // Mevcut günlük görünüm
      const data = [
        { name: '90+ Gün', value: yaslandirma.vade90Plus, key: 'vade90Plus', type: 'gecmis', color: 'hsl(var(--destructive))' },
        { name: '61-90', value: yaslandirma.vade90, key: 'vade90', type: 'gecmis', color: 'hsl(0 65% 50%)' },
        { name: '31-60', value: yaslandirma.vade60, key: 'vade60', type: 'gecmis', color: 'hsl(25 95% 53%)' },
        { name: '1-30', value: yaslandirma.vade30, key: 'vade30', type: 'gecmis', color: 'hsl(38 92% 50%)' },
        { name: 'BUGÜN', value: yaslandirma.guncel, key: 'guncel', type: 'guncel', color: 'hsl(var(--primary))' },
        { name: '-30', value: yaslandirma.gelecek30, key: 'gelecek30', type: 'gelecek', color: 'hsl(142 76% 46%)' },
        { name: '-60', value: yaslandirma.gelecek60, key: 'gelecek60', type: 'gelecek', color: 'hsl(142 72% 40%)' },
        { name: '-90', value: yaslandirma.gelecek90, key: 'gelecek90', type: 'gelecek', color: 'hsl(142 68% 34%)' },
        { name: '-90+', value: yaslandirma.gelecek90Plus, key: 'gelecek90Plus', type: 'gelecek', color: 'hsl(142 65% 28%)' },
      ];
      const toplam = data.reduce((acc, item) => acc + item.value, 0);
      const gecmis = yaslandirma.vade90Plus + yaslandirma.vade90 + yaslandirma.vade60 + yaslandirma.vade30;
      const gelecek = yaslandirma.gelecek30 + yaslandirma.gelecek60 + yaslandirma.gelecek90 + yaslandirma.gelecek90Plus;
      return { chartData: data, toplam, gecmisToplam: gecmis, gelecekToplam: gelecek };
    } else if (periyot === 'haftalik') {
      // Haftalık görünüm - günlük verileri haftalara grupla
      const data = [
        { 
          name: '4+ Hafta', 
          value: yaslandirma.vade90Plus + yaslandirma.vade90 * 0.5, 
          key: 'hafta4plus', 
          type: 'gecmis', 
          color: 'hsl(var(--destructive))' 
        },
        { 
          name: '3 Hafta', 
          value: yaslandirma.vade90 * 0.5 + yaslandirma.vade60 * 0.5, 
          key: 'hafta3', 
          type: 'gecmis', 
          color: 'hsl(0 65% 50%)' 
        },
        { 
          name: '2 Hafta', 
          value: yaslandirma.vade60 * 0.5 + yaslandirma.vade30 * 0.5, 
          key: 'hafta2', 
          type: 'gecmis', 
          color: 'hsl(25 95% 53%)' 
        },
        { 
          name: '1 Hafta', 
          value: yaslandirma.vade30 * 0.5, 
          key: 'hafta1', 
          type: 'gecmis', 
          color: 'hsl(38 92% 50%)' 
        },
        { 
          name: 'BU HAFTA', 
          value: yaslandirma.guncel, 
          key: 'buhafta', 
          type: 'guncel', 
          color: 'hsl(var(--primary))' 
        },
        { 
          name: '+1 Hafta', 
          value: yaslandirma.gelecek30 * 0.5, 
          key: 'gelecek1', 
          type: 'gelecek', 
          color: 'hsl(142 76% 46%)' 
        },
        { 
          name: '+2 Hafta', 
          value: yaslandirma.gelecek30 * 0.5 + yaslandirma.gelecek60 * 0.5, 
          key: 'gelecek2', 
          type: 'gelecek', 
          color: 'hsl(142 72% 40%)' 
        },
        { 
          name: '+3 Hafta', 
          value: yaslandirma.gelecek60 * 0.5 + yaslandirma.gelecek90 * 0.5, 
          key: 'gelecek3', 
          type: 'gelecek', 
          color: 'hsl(142 68% 34%)' 
        },
        { 
          name: '+4+ Hafta', 
          value: yaslandirma.gelecek90 * 0.5 + yaslandirma.gelecek90Plus, 
          key: 'gelecek4plus', 
          type: 'gelecek', 
          color: 'hsl(142 65% 28%)' 
        },
      ];
      const toplam = data.reduce((acc, item) => acc + item.value, 0);
      const gecmis = data.filter(d => d.type === 'gecmis').reduce((acc, d) => acc + d.value, 0);
      const gelecek = data.filter(d => d.type === 'gelecek').reduce((acc, d) => acc + d.value, 0);
      return { chartData: data, toplam, gecmisToplam: gecmis, gelecekToplam: gelecek };
    } else {
      // Aylık görünüm
      const data = [
        { 
          name: '3+ Ay', 
          value: yaslandirma.vade90Plus, 
          key: 'ay3plus', 
          type: 'gecmis', 
          color: 'hsl(var(--destructive))' 
        },
        { 
          name: '2 Ay', 
          value: yaslandirma.vade90 + yaslandirma.vade60, 
          key: 'ay2', 
          type: 'gecmis', 
          color: 'hsl(25 95% 53%)' 
        },
        { 
          name: '1 Ay', 
          value: yaslandirma.vade30, 
          key: 'ay1', 
          type: 'gecmis', 
          color: 'hsl(38 92% 50%)' 
        },
        { 
          name: 'BU AY', 
          value: yaslandirma.guncel, 
          key: 'buay', 
          type: 'guncel', 
          color: 'hsl(var(--primary))' 
        },
        { 
          name: '+1 Ay', 
          value: yaslandirma.gelecek30, 
          key: 'gelecekay1', 
          type: 'gelecek', 
          color: 'hsl(142 76% 46%)' 
        },
        { 
          name: '+2 Ay', 
          value: yaslandirma.gelecek60 + yaslandirma.gelecek90, 
          key: 'gelecekay2', 
          type: 'gelecek', 
          color: 'hsl(142 72% 40%)' 
        },
        { 
          name: '+3+ Ay', 
          value: yaslandirma.gelecek90Plus, 
          key: 'gelecekay3plus', 
          type: 'gelecek', 
          color: 'hsl(142 65% 28%)' 
        },
      ];
      const toplam = data.reduce((acc, item) => acc + item.value, 0);
      const gecmis = data.filter(d => d.type === 'gecmis').reduce((acc, d) => acc + d.value, 0);
      const gelecek = data.filter(d => d.type === 'gelecek').reduce((acc, d) => acc + d.value, 0);
      return { chartData: data, toplam, gecmisToplam: gecmis, gelecekToplam: gelecek };
    }
  }, [yaslandirma, periyot]);

  const guncelLabel = periyot === 'gunluk' ? 'BUGÜN' : periyot === 'haftalik' ? 'BU HAFTA' : 'BU AY';

  const handleBarClick = (data: any) => {
    if (data && data.key) {
      setFilter('vadeDilimi', filters.vadeDilimi === data.key ? null : data.key);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm">{data.name}</p>
          <p className="text-lg font-bold" style={{ color: data.color }}>
            {formatFullCurrency(data.value)}
          </p>
          <p className="text-xs text-muted-foreground">
            {((data.value / toplam) * 100).toFixed(1)}% toplam
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.type === 'gecmis' ? 'Vadesi Geçmiş' : data.type === 'guncel' ? 'Güncel' : 'Gelecek Vade'}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Nakit Akış Projeksiyonu</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="h-64 bg-secondary/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Nakit Akış Projeksiyonu (FIFO)</h3>
          <p className="text-sm text-muted-foreground">
            Vade yaşlandırma analizi - Toplam: <span className="font-semibold text-primary">{formatCurrency(toplam)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Periyot Seçici */}
          <div className="flex items-center bg-secondary/50 rounded-lg p-1">
            <button
              onClick={() => setPeriyot('gunluk')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                periyot === 'gunluk' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Günlük
            </button>
            <button
              onClick={() => setPeriyot('haftalik')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                periyot === 'haftalik' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Haftalık
            </button>
            <button
              onClick={() => setPeriyot('aylik')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                periyot === 'aylik' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Aylık
            </button>
          </div>
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-warning" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-destructive" />
          <span className="text-muted-foreground">Vadesi Geçmiş: <span className="font-semibold text-foreground">{formatCurrency(gecmisToplam)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span className="text-muted-foreground">Güncel: <span className="font-semibold text-foreground">{formatCurrency(chartData.find(d => d.type === 'guncel')?.value || 0)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-success" />
          <span className="text-muted-foreground">Gelecek Vade: <span className="font-semibold text-foreground">{formatCurrency(gelecekToplam)}</span></span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
            <ReferenceLine x={guncelLabel} stroke="hsl(var(--primary))" strokeDasharray="3 3" />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(data) => handleBarClick(data)}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  opacity={filters.vadeDilimi && filters.vadeDilimi !== entry.key ? 0.3 : 1}
                  stroke={filters.vadeDilimi === entry.key ? 'hsl(var(--foreground))' : 'none'}
                  strokeWidth={filters.vadeDilimi === entry.key ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Selected filter indicator */}
      {filters.vadeDilimi && (
        <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Seçili Vade Dilimi:</span>
            <span className="text-sm font-bold text-primary">
              {chartData.find(d => d.key === filters.vadeDilimi)?.name || filters.vadeDilimi}
            </span>
          </div>
          <button 
            onClick={() => setFilter('vadeDilimi', null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Temizle
          </button>
        </div>
      )}

      {/* Vadesi geçmiş uyarı */}
      {(yaslandirma.vade90Plus > 0) && (
        <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">
            <span className="font-semibold">{formatFullCurrency(yaslandirma.vade90Plus)}</span> tutarında 90 günü aşmış alacak bulunmaktadır.
          </p>
        </div>
      )}
    </div>
  );
}