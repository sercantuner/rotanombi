import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { VadeYaslandirma } from '@/lib/diaClient';

interface Props {
  yaslandirma: VadeYaslandirma;
  isLoading?: boolean;
}

type Period = 'haftalik' | 'aylik';

export function NakitAkisMetrikleri({ yaslandirma, isLoading }: Props) {
  const [period, setPeriod] = useState<Period>('aylik');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const metrics = useMemo(() => {
    // Haftalık metrikler yaklaşık olarak hesaplanıyor (30 gün / 4 hafta)
    const divisor = period === 'haftalik' ? 4 : 1;
    
    const gecmisVade = yaslandirma.vade30 / divisor; // 1-30 gün geçmiş
    const guncelVade = yaslandirma.guncel / divisor;
    const gelecekVade = yaslandirma.gelecek30 / divisor; // 1-30 gün gelecek
    
    const toplamGiris = gelecekVade + guncelVade;
    const toplamCikis = gecmisVade;
    const netAkis = toplamGiris - toplamCikis;
    
    return {
      toplamGiris,
      toplamCikis,
      netAkis,
      projectedBalance: netAkis * (period === 'haftalik' ? 4 : 1),
    };
  }, [yaslandirma, period]);

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-success" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Nakit Akış Metrikleri</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Nakit Akış Metrikleri</h3>
          <p className="text-sm text-muted-foreground">
            {period === 'haftalik' ? 'Haftalık' : 'Aylık'} projeksiyon
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setPeriod('haftalik')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === 'haftalik'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Haftalık
            </button>
            <button
              onClick={() => setPeriod('aylik')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === 'aylik'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Aylık
            </button>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Beklenen Tahsilat */}
        <div className="p-4 rounded-xl bg-success/10 border border-success/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Beklenen Tahsilat</p>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <p className="text-2xl font-bold text-success">{formatCurrency(metrics.toplamGiris)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {period === 'haftalik' ? 'Bu hafta' : 'Bu ay'}
          </p>
        </div>

        {/* Beklenen Ödeme */}
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Vadesi Geçen</p>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(metrics.toplamCikis)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tahsil edilmesi gereken
          </p>
        </div>

        {/* Net Akış */}
        <div className={`p-4 rounded-xl border ${
          metrics.netAkis >= 0 
            ? 'bg-primary/10 border-primary/20' 
            : 'bg-warning/10 border-warning/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Net Akış</p>
            {getTrendIcon(metrics.netAkis)}
          </div>
          <p className={`text-2xl font-bold ${
            metrics.netAkis >= 0 ? 'text-primary' : 'text-warning'
          }`}>
            {metrics.netAkis >= 0 ? '+' : ''}{formatCurrency(metrics.netAkis)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {period === 'haftalik' ? 'Haftalık' : 'Aylık'} bakiye değişimi
          </p>
        </div>

        {/* Projeksiyon */}
        <div className="p-4 rounded-xl bg-secondary/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Aylık Projeksiyon</p>
            {getTrendIcon(metrics.projectedBalance)}
          </div>
          <p className={`text-2xl font-bold ${
            metrics.projectedBalance >= 0 ? 'text-foreground' : 'text-warning'
          }`}>
            {metrics.projectedBalance >= 0 ? '+' : ''}{formatCurrency(metrics.projectedBalance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tahmini aylık etki
          </p>
        </div>
      </div>

      {/* Alt bilgi */}
      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 Metrikler vade yaşlandırma verilerine göre hesaplanmaktadır
        </p>
      </div>
    </div>
  );
}
