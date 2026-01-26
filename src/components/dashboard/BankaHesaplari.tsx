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
    // TL ve TRY'yi aynı şekilde işle
    const symbol = doviz === 'USD' ? '$' : doviz === 'EUR' ? '€' : '₺';
    return `${symbol}${Math.abs(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-3 md:p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Banka Hesapları</h3>
            <p className="text-xs text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-secondary/50 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-3 md:p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Banka Hesapları</h3>
          <p className="text-xs text-muted-foreground">
            Toplam: <span className="font-semibold text-primary">{formatCurrency(toplamBakiye)}</span>
          </p>
        </div>
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Building className="w-4 h-4 text-primary" />
        </div>
      </div>

      {bankaHesaplari.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Banka hesabı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {bankaHesaplari.map((banka, index) => (
            <div 
              key={banka.hesapKodu || index} 
              className="flex items-center justify-between p-2 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                  {banka.bankaAdi?.substring(0, 2).toUpperCase() || 'BN'}
                </div>
                <div>
                  <p className="font-medium text-xs">{banka.hesapAdi || banka.bankaAdi || 'Hesap'}</p>
                  <p className="text-[10px] text-muted-foreground">{banka.bankaAdi}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold text-xs ${banka.bakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(banka.bakiye, banka.dovizCinsi)}
                </p>
                <p className="text-[10px] text-muted-foreground">{banka.dovizCinsi}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
