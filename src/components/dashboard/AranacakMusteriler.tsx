import React, { useMemo, useState } from 'react';
import { Phone, AlertCircle, Clock, ChevronRight, User, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

interface AranacakMusteri {
  cariKodu: string;
  cariAdi: string;
  telefon: string;
  bakiye: number;
  gecikmeGunu: number;
  oncelik: 'yuksek' | 'orta' | 'normal';
  sebep: string;
}

export function AranacakMusteriler({ cariler, isLoading }: Props) {
  const [showAll, setShowAll] = useState(false);

  const aranacaklar = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const musteriler: AranacakMusteri[] = [];

    cariler.forEach(cari => {
      // Sadece bakiyesi pozitif olanları (bizim alacağımız var) kontrol et
      if (cari.bakiye <= 0) return;
      
      // Risk skoru yüksek olanlar
      if (cari.riskAnalizi && cari.riskAnalizi.riskSkoru >= 60) {
        const maxGecikme = cari.riskAnalizi.maxGecikmeGunu || 0;
        let oncelik: 'yuksek' | 'orta' | 'normal' = 'normal';
        let sebep = '';

        if (maxGecikme > 30) {
          oncelik = 'yuksek';
          sebep = `${maxGecikme} gün gecikmiş`;
        } else if (maxGecikme > 7) {
          oncelik = 'orta';
          sebep = `${maxGecikme} gün gecikmiş`;
        } else if (maxGecikme > 0) {
          sebep = `${maxGecikme} gün gecikmiş`;
        }

        // Bugün vadesi gelenler
        if (cari.fifo?.acikFaturalar) {
          const todayStr = today.toISOString().split('T')[0];
          const bugunVadeli = cari.fifo.acikFaturalar.some(f => f.vadetarihi === todayStr);
          if (bugunVadeli) {
            oncelik = 'yuksek';
            sebep = 'Bugün vadesi geliyor';
          }
        }

        if (sebep) {
          musteriler.push({
            cariKodu: cari.cariKodu,
            cariAdi: cari.cariAdi,
            telefon: cari.telefon || '',
            bakiye: cari.bakiye,
            gecikmeGunu: maxGecikme,
            oncelik,
            sebep,
          });
        }
      }
    });

    // Önceliğe göre sırala
    return musteriler.sort((a, b) => {
      const oncelikSirasi = { yuksek: 0, orta: 1, normal: 2 };
      if (oncelikSirasi[a.oncelik] !== oncelikSirasi[b.oncelik]) {
        return oncelikSirasi[a.oncelik] - oncelikSirasi[b.oncelik];
      }
      return b.bakiye - a.bakiye;
    });
  }, [cariler]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `₺${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const getOncelikStyle = (oncelik: AranacakMusteri['oncelik']) => {
    switch (oncelik) {
      case 'yuksek':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'orta':
        return 'bg-warning/10 border-warning/30 text-warning';
      default:
        return 'bg-primary/10 border-primary/30 text-primary';
    }
  };

  const getOncelikIcon = (oncelik: AranacakMusteri['oncelik']) => {
    switch (oncelik) {
      case 'yuksek':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'orta':
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return <Calendar className="w-4 h-4 text-primary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-muted rounded w-44 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const yuksekOncelik = aranacaklar.filter(m => m.oncelik === 'yuksek').length;
  const ortaOncelik = aranacaklar.filter(m => m.oncelik === 'orta').length;

  const displayList = showAll ? aranacaklar : aranacaklar.slice(0, 5);

  return (
    <div className="glass-card rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold">Bugün Aranacaklar</h3>
            <p className="text-xs text-muted-foreground">
              Takip edilmesi gereken müşteriler
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {yuksekOncelik > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-destructive/20 text-destructive">
              {yuksekOncelik} acil
            </span>
          )}
          {ortaOncelik > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/20 text-warning">
              {ortaOncelik} önemli
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {aranacaklar.length > 0 ? (
        <>
          <ScrollArea className={showAll ? 'h-64' : 'max-h-64'}>
            <div className="space-y-2">
              {displayList.map((musteri) => (
                <div 
                  key={musteri.cariKodu}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.01] ${getOncelikStyle(musteri.oncelik)}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getOncelikIcon(musteri.oncelik)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{musteri.cariAdi}</p>
                      <p className="text-xs opacity-80">{musteri.sebep}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold">{formatCurrency(musteri.bakiye)}</p>
                    {musteri.telefon ? (
                      <a 
                        href={`tel:${musteri.telefon}`}
                        className="p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                        title={musteri.telefon}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    ) : (
                      <div className="p-2 rounded-lg bg-background/50 opacity-50">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {aranacaklar.length > 5 && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
            >
              {showAll ? 'Daha az göster' : `Tümünü göster (${aranacaklar.length})`}
              <ChevronRight className={`w-3 h-3 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <Phone className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Bugün aranacak müşteri yok</p>
          <p className="text-xs text-muted-foreground mt-1">Tüm takipler güncel!</p>
        </div>
      )}
    </div>
  );
}
