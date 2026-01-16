import React from 'react';
import { Tag } from 'lucide-react';
import type { OzelkodDagilimi as OzelkodData } from '@/lib/diaClient';
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';

interface Props {
  ozelkodlar: OzelkodData[];
  isLoading?: boolean;
}

export function OzelkodDagilimi({ ozelkodlar, isLoading }: Props) {
  const { filters, toggleArrayFilter } = useDashboardFilters();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
  };

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

  const handleClick = (kod: string) => {
    toggleArrayFilter('ozelkod2', kod);
  };

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Özelkod Dağılımı</h3>
          <p className="text-sm text-muted-foreground">
            {ozelkodlar.length} kategori · <span className="text-primary">Tıklayarak filtrele</span>
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
          {ozelkodlar.slice(0, 10).map((item, index) => {
            const isSelected = filters.ozelkod2.includes(item.kod);
            const isFiltered = filters.ozelkod2.length > 0 && !isSelected;
            
            return (
              <div 
                key={item.kod || index} 
                onClick={() => handleClick(item.kod)}
                className={`
                  p-3 rounded-lg transition-all cursor-pointer space-y-2
                  ${isSelected 
                    ? 'bg-primary/20 border-2 border-primary shadow-sm ring-2 ring-primary/20' 
                    : isFiltered 
                      ? 'bg-secondary/20 opacity-40 hover:opacity-60' 
                      : 'bg-secondary/30 hover:bg-secondary/50 border-2 border-transparent'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                      {index + 1}
                    </span>
                    <span className="font-medium text-sm">{item.kod || 'Tanımsız'}</span>
                    {isSelected && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                        Seçili
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(item.toplam)}</p>
                    <p className="text-xs text-muted-foreground">{item.adet} cari</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-primary' : 'bg-primary/60'}`}
                    style={{ width: `${(item.toplam / maxToplam) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active filter indicator */}
      {filters.ozelkod2.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{filters.ozelkod2.length} özel kod seçili</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                filters.ozelkod2.forEach(kod => toggleArrayFilter('ozelkod2', kod));
              }}
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Tümünü temizle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
