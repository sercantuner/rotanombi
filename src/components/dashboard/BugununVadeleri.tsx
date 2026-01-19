import React, { useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Clock, Phone } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

interface VadeItem {
  cariKodu: string;
  cariAdi: string;
  tutar: number;
  tip: 'alacak' | 'borc';
  telefon: string;
}

export function BugununVadeleri({ cariler, isLoading }: Props) {
  const bugunVadeler = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const vadeler: VadeItem[] = [];

    cariler.forEach(cari => {
      // FIFO açık faturalarından bugün vadeli olanları bul
      if (cari.fifo?.acikFaturalar) {
        cari.fifo.acikFaturalar.forEach(fatura => {
          if (fatura.vadetarihi === todayStr && fatura.kalan > 0) {
            vadeler.push({
              cariKodu: cari.cariKodu,
              cariAdi: cari.cariAdi,
              tutar: fatura.kalan,
              tip: cari.bakiye > 0 ? 'alacak' : 'borc',
              telefon: cari.telefon || '',
            });
          }
        });
      }
    });

    return vadeler;
  }, [cariler]);

  const toplamAlacak = bugunVadeler
    .filter(v => v.tip === 'alacak')
    .reduce((sum, v) => sum + v.tutar, 0);
  
  const toplamBorc = bugunVadeler
    .filter(v => v.tip === 'borc')
    .reduce((sum, v) => sum + v.tutar, 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `₺${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-muted rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Bugün Vadesi Gelen</h3>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <Clock className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-success/10 border border-success/30">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-xs text-success font-medium">Alacaklar</span>
          </div>
          <p className="text-lg font-bold text-success">{formatCurrency(toplamAlacak)}</p>
          <p className="text-xs text-muted-foreground">
            {bugunVadeler.filter(v => v.tip === 'alacak').length} fatura
          </p>
        </div>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive font-medium">Borçlar</span>
          </div>
          <p className="text-lg font-bold text-destructive">{formatCurrency(toplamBorc)}</p>
          <p className="text-xs text-muted-foreground">
            {bugunVadeler.filter(v => v.tip === 'borc').length} fatura
          </p>
        </div>
      </div>

      {/* List */}
      {bugunVadeler.length > 0 ? (
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {bugunVadeler.slice(0, 10).map((vade, index) => (
              <div 
                key={`${vade.cariKodu}-${index}`}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.01] ${
                  vade.tip === 'alacak' 
                    ? 'bg-success/5 border-success/20' 
                    : 'bg-destructive/5 border-destructive/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{vade.cariAdi}</p>
                  <p className="text-xs text-muted-foreground">{vade.cariKodu}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-sm font-bold ${
                    vade.tip === 'alacak' ? 'text-success' : 'text-destructive'
                  }`}>
                    {formatCurrency(vade.tutar)}
                  </p>
                  {vade.telefon && (
                    <button 
                      className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title={vade.telefon}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Bugün vadesi gelen ödeme yok</p>
        </div>
      )}

      {bugunVadeler.length > 10 && (
        <p className="text-xs text-center text-muted-foreground mt-3">
          +{bugunVadeler.length - 10} daha fazla
        </p>
      )}
    </div>
  );
}
