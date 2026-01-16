import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

const riskBadges: Record<string, string> = {
  'düşük': 'bg-success/20 text-success',
  'orta': 'bg-warning/20 text-warning',
  'yüksek': 'bg-destructive/20 text-destructive',
};

function getRiskLabel(skor: number): string {
  if (skor >= 50) return 'yüksek';
  if (skor >= 25) return 'orta';
  return 'düşük';
}

export function TopCustomers({ cariler, isLoading }: Props) {
  const formatCurrency = (value: number) => {
    return `₺${Math.abs(value).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // En yüksek bakiyeli 5 cari
  const topCariler = [...cariler]
    .sort((a, b) => b.toplambakiye - a.toplambakiye)
    .slice(0, 5);

  const maxBakiye = Math.max(...topCariler.map(c => c.toplambakiye), 1);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">En İyi Müşteriler</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">En İyi Müşteriler</h3>
          <p className="text-sm text-muted-foreground">Bakiye bazlı sıralama</p>
        </div>
      </div>

      {topCariler.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Cari verisi bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topCariler.map((cari, index) => {
            const riskLabel = getRiskLabel(cari.riskSkoru);
            return (
              <div key={cari._key || index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[180px]" title={cari.cariAdi}>
                        {cari.cariAdi || cari.cariKodu}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{cari.cariKodu}</span>
                        {cari.ozelkod2kod && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary text-xs">
                            {cari.ozelkod2kod}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${cari.toplambakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(cari.toplambakiye)}
                    </p>
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${riskBadges[riskLabel]}`}>
                        {riskLabel}
                      </span>
                      {cari.vadesigecentutar > 0 && (
                        <span title={`Vadesi geçmiş: ${formatCurrency(cari.vadesigecentutar)}`}><AlertTriangle className="w-3 h-3 text-warning" /></span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(cari.toplambakiye / maxBakiye) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
