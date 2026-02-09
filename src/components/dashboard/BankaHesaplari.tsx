import React from 'react';
import { Building, Wallet } from 'lucide-react';
import type { DiaBankaHesabi } from '@/lib/diaClient';
import { Badge } from '@/components/ui/badge';

interface Props {
  bankaHesaplari: DiaBankaHesabi[];
  toplamBakiye: number;
  isLoading?: boolean;
  colors?: string[];
}

export function BankaHesaplari({ bankaHesaplari, toplamBakiye, isLoading, colors }: Props) {
  const formatCurrency = (value: number, doviz: string = 'TRY') => {
    const symbol = doviz === 'USD' ? '$' : doviz === 'EUR' ? '€' : '₺';
    const formatted = Math.abs(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${value < 0 ? '-' : ''}${formatted}`;
  };

  const getColor = (index: number) => {
    if (colors && colors[index % colors.length]) {
      return colors[index % colors.length];
    }
    return ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))'][index];
  };

  // Döviz bazlı toplamları hesapla
  const kpiTotals = React.useMemo(() => {
    const totals = { TRY: 0, USD: 0, EUR: 0 };
    bankaHesaplari.forEach(item => {
      const rawCurrency = item.dovizCinsi?.toUpperCase() || 'TRY';
      const currency = rawCurrency === 'TL' ? 'TRY' : rawCurrency;
      
      if (currency in totals) {
        totals[currency as keyof typeof totals] += item.bakiye;
      } else {
        totals.TRY += item.bakiye;
      }
    });
    return totals;
  }, [bankaHesaplari]);

  const kpiCards = [
    { label: 'Toplam TL Varlığı', value: kpiTotals.TRY, currency: 'TRY', colorIndex: 0 },
    { label: 'Toplam USD Varlığı', value: kpiTotals.USD, currency: 'USD', colorIndex: 1 },
    { label: 'Toplam EUR Varlığı', value: kpiTotals.EUR, currency: 'EUR', colorIndex: 2 },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-2">
        {/* KPI Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2 bg-card rounded-none border border-border animate-pulse">
              <div className="h-3 bg-muted rounded w-16 mb-2" />
              <div className="h-6 bg-muted rounded w-24" />
            </div>
          ))}
        </div>
        {/* Table Skeleton */}
        <div className="flex-1 bg-card rounded-none border border-border">
          <div className="p-2 border-b border-border bg-muted/20">
            <div className="h-4 bg-muted rounded w-32" />
          </div>
          <div className="space-y-1 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted/50 rounded-none animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 overflow-hidden" style={{ height: '100%', maxHeight: 'inherit' }}>
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="p-2 bg-card rounded-none border border-border shadow-sm"
          >
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: getColor(kpi.colorIndex) }} 
              />
              {kpi.label}
            </div>
            <p className="text-xl font-bold" style={{ color: getColor(kpi.colorIndex) }}>
              {formatCurrency(kpi.value, kpi.currency)}
            </p>
          </div>
        ))}
      </div>

      {/* Tablo Listesi */}
      <div className="flex flex-col flex-1 min-h-0 bg-card rounded-none border border-border">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-2 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Banka Hesap Listesi</span>
          </div>
          <Badge variant="secondary" className="rounded-none text-xs">
            {bankaHesaplari.length} Hesap
          </Badge>
        </div>

        {bankaHesaplari.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-8">
            <Wallet className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Banka hesabı bulunamadı</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Hesap Adı</th>
                  <th className="p-2">Banka</th>
                  <th className="p-2 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bankaHesaplari.map((banka, index) => (
                  <tr
                    key={banka.hesapKodu || index}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-none flex items-center justify-center bg-secondary text-[10px] font-bold text-foreground">
                          {banka.bankaAdi?.substring(0, 2).toUpperCase() || 'BN'}
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">
                          {banka.hesapAdi || banka.bankaAdi || 'Hesap'}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {banka.bankaAdi || '-'}
                    </td>
                    <td className="p-2 text-right">
                      <div>
                        <p className={`text-sm font-semibold ${banka.bakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(banka.bakiye, banka.dovizCinsi)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{banka.dovizCinsi}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
