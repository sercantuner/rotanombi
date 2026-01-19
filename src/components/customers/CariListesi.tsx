import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Building2, Phone, Mail, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DiaCari } from '@/lib/diaClient';

interface Props {
  cariler: DiaCari[];
  isLoading?: boolean;
}

type SortField = 'cariAdi' | 'bakiye' | 'riskSkoru' | 'sehir';
type SortOrder = 'asc' | 'desc';

export function CariListesi({ cariler, isLoading }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('bakiye');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const filteredAndSortedCariler = useMemo(() => {
    let result = [...cariler];
    
    // Arama filtresi
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.cariAdi?.toLowerCase().includes(search) ||
        c.cariKodu?.toLowerCase().includes(search) ||
        c.sehir?.toLowerCase().includes(search)
      );
    }
    
    // Sıralama
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === 'riskSkoru') {
        aVal = a.riskAnalizi?.riskSkoru || 0;
        bVal = b.riskAnalizi?.riskSkoru || 0;
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal?.toLowerCase() || '';
        bVal = bVal?.toLowerCase() || '';
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
    
    return result;
  }, [cariler, searchTerm, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `₺${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const getRiskColor = (risk?: number) => {
    if (!risk) return 'text-muted-foreground';
    if (risk >= 70) return 'text-destructive';
    if (risk >= 40) return 'text-warning';
    return 'text-success';
  };

  const getRiskBg = (risk?: number) => {
    if (!risk) return 'bg-muted';
    if (risk >= 70) return 'bg-destructive/20';
    if (risk >= 40) return 'bg-warning/20';
    return 'bg-success/20';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 animate-pulse">
        <div className="h-10 bg-muted rounded w-64 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-lg">Cari Listesi</h3>
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedCariler.length} / {cariler.length} kayıt gösteriliyor
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari ara..."
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center bg-secondary rounded-lg p-1">
            <button 
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('table')}
            >
              Tablo
            </button>
            <button 
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('cards')}
            >
              Kart
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        /* Table View */
        <ScrollArea className="h-[500px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
              <tr className="border-b border-border">
                <th 
                  className="text-left py-3 px-4 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort('cariAdi')}
                >
                  <div className="flex items-center gap-1">
                    Cari Adı
                    <SortIcon field="cariAdi" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-4 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort('bakiye')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Bakiye
                    <SortIcon field="bakiye" />
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-4 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort('riskSkoru')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Risk
                    <SortIcon field="riskSkoru" />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell"
                  onClick={() => toggleSort('sehir')}
                >
                  <div className="flex items-center gap-1">
                    Şehir
                    <SortIcon field="sehir" />
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                  Durum
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground hidden xl:table-cell">
                  İletişim
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCariler.slice(0, 100).map((cari) => (
                <tr 
                  key={cari._key || cari.cariKodu} 
                  className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cari.cariAdi}</p>
                        <p className="text-xs text-muted-foreground">{cari.cariKodu}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`text-sm font-bold ${cari.bakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {cari.bakiye >= 0 ? '+' : ''}{formatCurrency(cari.bakiye)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-md text-xs font-bold ${getRiskBg(cari.riskAnalizi?.riskSkoru)} ${getRiskColor(cari.riskAnalizi?.riskSkoru)}`}>
                      {cari.riskAnalizi?.riskSkoru || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">{cari.sehir || '-'}</span>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      {cari.potansiyel ? (
                        <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
                          Potansiyel
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
                          Cari
                        </span>
                      )}
                      {cari.durum === 'P' && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                          Pasif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      {cari.telefon && (
                        <a href={`tel:${cari.telefon}`} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20" title={cari.telefon}>
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {cari.eposta && (
                        <a href={`mailto:${cari.eposta}`} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20" title={cari.eposta}>
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedCariler.length > 100 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              İlk 100 kayıt gösteriliyor. Daha fazlası için filtreleri kullanın.
            </p>
          )}
        </ScrollArea>
      ) : (
        /* Card View */
        <ScrollArea className="h-[500px]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAndSortedCariler.slice(0, 50).map((cari) => (
              <div 
                key={cari._key || cari.cariKodu}
                className="p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{cari.cariAdi}</p>
                      <p className="text-xs text-muted-foreground">{cari.cariKodu}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center justify-center w-10 h-6 rounded-md text-xs font-bold ${getRiskBg(cari.riskAnalizi?.riskSkoru)} ${getRiskColor(cari.riskAnalizi?.riskSkoru)}`}>
                    {cari.riskAnalizi?.riskSkoru || '-'}
                  </span>
                </div>

                {/* Balance */}
                <div className="p-3 rounded-lg bg-background/50 mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Bakiye</p>
                  <p className={`text-xl font-bold ${cari.bakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {cari.bakiye >= 0 ? '+' : ''}{formatCurrency(cari.bakiye)}
                  </p>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-3">
                  {cari.sehir && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{cari.sehir}</span>
                    </div>
                  )}
                  {cari.telefon && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{cari.telefon}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    {cari.potansiyel ? (
                      <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
                        Potansiyel
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
                        Cari
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                      {cari.carikarttipi}
                    </span>
                  </div>
                  {cari.durum === 'P' ? (
                    <span title="Pasif"><AlertTriangle className="w-4 h-4 text-muted-foreground" /></span>
                  ) : (
                    <span title="Aktif"><CheckCircle className="w-4 h-4 text-success" /></span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {filteredAndSortedCariler.length > 50 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              İlk 50 kayıt gösteriliyor. Daha fazlası için filtreleri kullanın.
            </p>
          )}
        </ScrollArea>
      )}

      {/* Empty State */}
      {filteredAndSortedCariler.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Cari bulunamadı</h3>
          <p className="text-muted-foreground">Arama kriterlerinize uygun cari hesap bulunamadı.</p>
        </div>
      )}
    </div>
  );
}
