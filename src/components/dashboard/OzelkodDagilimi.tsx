import React from 'react';
import { Tag } from 'lucide-react';
import type { OzelkodDagilimi as OzelkodData } from '@/lib/diaClient';

interface Props {
  ozelkodlar: OzelkodData[];
  isLoading?: boolean;
}

export function OzelkodDagilimi({ ozelkodlar, isLoading }: Props) {
  const formatCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const toplam = ozelkodlar.reduce((acc, item) => acc + item.toplam, 0);
  const maxToplam = Math.max(...ozelkodlar.map(o => o.toplam), 1);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Özelkod Dağılımı</h3>
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
          <h3 className="text-lg font-semibold">Özelkod Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {ozelkodlar.length} kategori
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-accent-foreground" />
        </div>
      </div>

      {ozelkodlar.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Özelkod verisi bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {ozelkodlar.slice(0, 10).map((item, index) => (
            <div key={item.kod || index} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="font-medium text-sm">{item.kod || 'Tanımsız'}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(item.toplam)}</p>
                  <p className="text-xs text-muted-foreground">{item.adet} cari</p>
                </div>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
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
