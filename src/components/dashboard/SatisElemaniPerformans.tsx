import React from 'react';
import { Users } from 'lucide-react';
import type { SatisElemaniDagilimi } from '@/lib/diaClient';

interface Props {
  satisElemanlari: SatisElemaniDagilimi[];
  isLoading?: boolean;
}

export function SatisElemaniPerformans({ satisElemanlari, isLoading }: Props) {
  const formatCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const maxToplam = Math.max(...satisElemanlari.map(s => s.toplam), 1);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Satış Elemanı Performansı</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Satış Elemanı Performansı</h3>
          <p className="text-sm text-muted-foreground">
            {satisElemanlari.length} satış elemanı
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-success" />
        </div>
      </div>

      {satisElemanlari.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Satış elemanı verisi bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {satisElemanlari.slice(0, 10).map((item, index) => (
            <div key={item.eleman || index} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {item.eleman?.substring(0, 2).toUpperCase() || '??'}
                  </div>
                  <div>
                    <span className="font-medium text-sm">{item.eleman || 'Tanımsız'}</span>
                    <p className="text-xs text-muted-foreground">{item.adet} müşteri</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(item.toplam)}</p>
                </div>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${(item.toplam / maxToplam) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
