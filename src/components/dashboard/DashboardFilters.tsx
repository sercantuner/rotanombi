import React from 'react';
import { Filter, X, Search } from 'lucide-react';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  totalCustomers: number;
  filteredCount?: number;
}

export function DashboardFilters({ totalCustomers, filteredCount }: Props) {
  const { 
    filters, 
    setFilter, 
    toggleArrayFilter,
    clearFilters, 
    activeFilterCount 
  } = useGlobalFilters();

  const displayCount = filteredCount !== undefined ? filteredCount : totalCustomers;
  const showRatio = filteredCount !== undefined && filteredCount !== totalCustomers;

  return (
    <div className="glass-card rounded-xl p-4 mb-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hızlı cari ara..."
            value={filters.searchTerm}
            onChange={(e) => setFilter('searchTerm', e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Cari Kart Tipi (AL/AS/ST) */}
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
          {['AL', 'AS', 'ST'].map((tip) => (
            <button
              key={tip}
              onClick={() => toggleArrayFilter('cariKartTipi', tip)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filters.cariKartTipi.includes(tip)
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tip === 'AL' ? 'Alıcı' : tip === 'AS' ? 'Al-Sat' : 'Satıcı'}
            </button>
          ))}
        </div>

        {/* Görünüm Modu */}
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
          {['hepsi', 'potansiyel', 'cari'].map((mod) => (
            <button
              key={mod}
              onClick={() => setFilter('gorunumModu', mod as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filters.gorunumModu === mod 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mod === 'hepsi' ? 'Hepsi' : mod === 'potansiyel' ? 'Potansiyel' : 'Cari'}
            </button>
          ))}
        </div>

        {/* Durum */}
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
          {['hepsi', 'aktif', 'pasif'].map((durum) => (
            <button
              key={durum}
              onClick={() => setFilter('durum', durum as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filters.durum === durum 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {durum === 'aktif' ? 'Aktif' : durum === 'pasif' ? 'Pasif' : 'Hepsi'}
            </button>
          ))}
        </div>

        {/* Total count badge */}
        <Badge variant="outline" className="h-9 px-4 gap-2 text-sm font-semibold">
          <span className="text-primary">{displayCount}</span>
          <span className="text-muted-foreground font-normal">
            {showRatio ? `/ ${totalCustomers} Cari` : 'Cari'}
          </span>
        </Badge>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            Temizle ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {(filters.cariKartTipi.length > 0 || filters.ozelkod2.length > 0 || filters.satisTemsilcisi.length > 0 || filters.vadeDilimi) && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
          <Filter className="w-4 h-4 text-muted-foreground" />
          
          {filters.cariKartTipi.map((tip) => (
            <Badge key={tip} variant="secondary" className="gap-1 pr-1 bg-accent/20 text-accent-foreground">
              Tip: {tip === 'AL' ? 'Alıcı' : tip === 'AS' ? 'Al-Sat' : 'Satıcı'}
              <button 
                onClick={() => toggleArrayFilter('cariKartTipi', tip)}
                className="ml-1 hover:bg-accent/30 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          
          {filters.vadeDilimi && (
            <Badge variant="secondary" className="gap-1 pr-1">
              Vade: {filters.vadeDilimi}
              <button 
                onClick={() => setFilter('vadeDilimi', null)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          
          {filters.ozelkod2.map((kod) => (
            <Badge key={kod} variant="secondary" className="gap-1 pr-1 bg-primary/10 text-primary">
              ÖK2: {kod}
              <button 
                onClick={() => setFilter('ozelkod2', filters.ozelkod2.filter(k => k !== kod))}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          
          {filters.satisTemsilcisi.map((eleman) => (
            <Badge key={eleman} variant="secondary" className="gap-1 pr-1 bg-success/10 text-success">
              {eleman}
              <button 
                onClick={() => setFilter('satisTemsilcisi', filters.satisTemsilcisi.filter(e => e !== eleman))}
                className="ml-1 hover:bg-success/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
