import React from 'react';
import { Users, User2 } from 'lucide-react';
import type { SatisElemaniDagilimi } from '@/lib/diaClient';
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';

interface Props {
  satisElemanlari: SatisElemaniDagilimi[];
  isLoading?: boolean;
}

export function SatisElemaniPerformans({ satisElemanlari, isLoading }: Props) {
  const { filters, toggleArrayFilter } = useDashboardFilters();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
    return `₺${value.toLocaleString('tr-TR')}`;
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

  const handleClick = (eleman: string) => {
    toggleArrayFilter('satisTemsilcisi', eleman);
  };

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Satış Elemanı Performansı</h3>
          <p className="text-sm text-muted-foreground">
            {satisElemanlari.length} satış elemanı · <span className="text-success">Tıklayarak filtrele</span>
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
          {satisElemanlari.slice(0, 10).map((item, index) => {
            const isSelected = filters.satisTemsilcisi.includes(item.eleman);
            const isFiltered = filters.satisTemsilcisi.length > 0 && !isSelected;
            
            return (
              <div 
                key={item.eleman || index} 
                onClick={() => handleClick(item.eleman)}
                className={`
                  p-3 rounded-lg transition-all cursor-pointer space-y-2
                  ${isSelected 
                    ? 'bg-success/20 border-2 border-success shadow-sm ring-2 ring-success/20' 
                    : isFiltered 
                      ? 'bg-secondary/20 opacity-40 hover:opacity-60' 
                      : 'bg-secondary/30 hover:bg-secondary/50 border-2 border-transparent'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-success text-white' : 'bg-gradient-to-br from-primary to-primary/60 text-primary-foreground'}`}>
                      {item.eleman?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{item.eleman || 'Tanımsız'}</span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success text-white ml-2">
                          Seçili
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">{item.adet} müşteri</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${isSelected ? 'text-success' : ''}`}>{formatCurrency(item.toplam)}</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-success' : 'bg-success/60'}`}
                    style={{ width: `${(item.toplam / maxToplam) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active filter indicator */}
      {filters.satisTemsilcisi.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{filters.satisTemsilcisi.length} temsilci seçili</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                filters.satisTemsilcisi.forEach(e => toggleArrayFilter('satisTemsilcisi', e));
              }}
              className="text-success hover:text-success/80 transition-colors font-medium"
            >
              Tümünü temizle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
