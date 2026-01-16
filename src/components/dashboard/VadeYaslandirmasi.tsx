import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import type { VadeYaslandirma } from '@/lib/diaClient';

interface Props {
  yaslandirma: VadeYaslandirma;
  isLoading?: boolean;
}

export function VadeYaslandirmasi({ yaslandirma, isLoading }: Props) {
  const formatCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toplam = yaslandirma.guncel + yaslandirma.vade30 + yaslandirma.vade60 + yaslandirma.vade90 + yaslandirma.vade90Plus;
  
  const getPercentage = (value: number) => {
    if (toplam === 0) return 0;
    return (value / toplam) * 100;
  };

  const vadeDilimleri = [
    { label: 'Güncel', value: yaslandirma.guncel, color: 'bg-success', textColor: 'text-success' },
    { label: '1-30 Gün', value: yaslandirma.vade30, color: 'bg-blue-500', textColor: 'text-blue-500' },
    { label: '31-60 Gün', value: yaslandirma.vade60, color: 'bg-warning', textColor: 'text-warning' },
    { label: '61-90 Gün', value: yaslandirma.vade90, color: 'bg-orange-500', textColor: 'text-orange-500' },
    { label: '90+ Gün', value: yaslandirma.vade90Plus, color: 'bg-destructive', textColor: 'text-destructive' },
  ];

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Vade Yaşlandırma (FIFO)</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="h-32 bg-secondary/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Vade Yaşlandırma (FIFO)</h3>
          <p className="text-sm text-muted-foreground">
            Toplam Alacak: <span className="font-semibold text-primary">{formatCurrency(toplam)}</span>
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-warning" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-4 rounded-full bg-secondary overflow-hidden mb-6 flex">
        {vadeDilimleri.map((dilim, index) => (
          <div
            key={dilim.label}
            className={`${dilim.color} transition-all duration-500`}
            style={{ width: `${getPercentage(dilim.value)}%` }}
            title={`${dilim.label}: ${formatCurrency(dilim.value)}`}
          />
        ))}
      </div>

      {/* Table */}
      <div className="space-y-2">
        {vadeDilimleri.map((dilim) => (
          <div 
            key={dilim.label} 
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${dilim.color}`} />
              <span className="font-medium text-sm">{dilim.label}</span>
              {dilim.label === '90+ Gün' && dilim.value > 0 && (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className={`font-semibold text-sm ${dilim.textColor}`}>
                {formatCurrency(dilim.value)}
              </span>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {getPercentage(dilim.value).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Vadesi geçmiş uyarı */}
      {(yaslandirma.vade90Plus > 0) && (
        <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">
            <span className="font-semibold">{formatCurrency(yaslandirma.vade90Plus)}</span> tutarında 90 günü aşmış alacak bulunmaktadır.
          </p>
        </div>
      )}
    </div>
  );
}
