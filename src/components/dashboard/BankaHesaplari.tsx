import React from 'react';
import { Building, Wallet } from 'lucide-react';
import type { DiaBankaHesabi } from '@/lib/diaClient';

interface Props {
  bankaHesaplari: DiaBankaHesabi[];
  toplamBakiye: number;
  isLoading?: boolean;
}

export function BankaHesaplari({ bankaHesaplari, toplamBakiye, isLoading }: Props) {
  const formatCurrency = (value: number, doviz: string = 'TRY') => {
    const symbol = doviz === 'USD' ? '$' : doviz === 'EUR' ? '€' : '₺';
    return `${symbol}${Math.abs(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Banka Hesapları</h3>
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
          <h3 className="text-lg font-semibold">Banka Hesapları</h3>
          <p className="text-sm text-muted-foreground">
            Toplam: <span className="font-semibold text-primary">{formatCurrency(toplamBakiye)}</span>
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building className="w-5 h-5 text-primary" />
        </div>
      </div>

      {bankaHesaplari.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Banka hesabı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {bankaHesaplari.map((banka, index) => (
            <div 
              key={banka.hesapKodu || index} 
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {banka.bankaAdi?.substring(0, 2).toUpperCase() || 'BN'}
                </div>
                <div>
                  <p className="font-medium text-sm">{banka.hesapAdi || banka.bankaAdi || 'Hesap'}</p>
                  <p className="text-xs text-muted-foreground">{banka.bankaAdi}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold text-sm ${banka.bakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(banka.bakiye, banka.dovizCinsi)}
                </p>
                <p className="text-xs text-muted-foreground">{banka.dovizCinsi}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
