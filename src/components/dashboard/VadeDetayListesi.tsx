import React from 'react';
import { X, Phone, Mail, Calendar, AlertTriangle, Building2 } from 'lucide-react';
import type { DiaCari } from '@/lib/diaClient';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  cariler: DiaCari[];
  yaslandirma: {
    vade90Plus: number;
    vade90: number;
    vade60: number;
    vade30: number;
    guncel: number;
    gelecek30: number;
    gelecek60: number;
    gelecek90: number;
    gelecek90Plus: number;
  };
}

const vadeDilimiLabels: Record<string, string> = {
  vade90Plus: '90+ Gün Gecikmiş',
  vade90: '61-90 Gün Gecikmiş',
  vade60: '31-60 Gün Gecikmiş',
  vade30: '1-30 Gün Gecikmiş',
  guncel: 'Bugün',
  gelecek30: '1-30 Gün Sonra',
  gelecek60: '31-60 Gün Sonra',
  gelecek90: '61-90 Gün Sonra',
  gelecek90Plus: '90+ Gün Sonra',
};

const vadeDilimiColors: Record<string, string> = {
  vade90Plus: 'bg-destructive text-destructive-foreground',
  vade90: 'bg-red-500 text-white',
  vade60: 'bg-orange-500 text-white',
  vade30: 'bg-yellow-500 text-black',
  guncel: 'bg-primary text-primary-foreground',
  gelecek30: 'bg-green-500 text-white',
  gelecek60: 'bg-green-600 text-white',
  gelecek90: 'bg-green-700 text-white',
  gelecek90Plus: 'bg-green-800 text-white',
};

export function VadeDetayListesi({ cariler, yaslandirma }: Props) {
  const { filters, setFilter } = useGlobalFilters();

  const formatCurrency = (value: number) => {
    return `₺${Math.abs(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // If no vade dilimi selected, don't show this component
  if (!filters.vadeDilimi) {
    return null;
  }

  const selectedDilim = filters.vadeDilimi;
  const dilimLabel = vadeDilimiLabels[selectedDilim] || selectedDilim;
  const dilimColor = vadeDilimiColors[selectedDilim] || 'bg-secondary';

  // Filter cariler based on their yaslandirma matching the selected dilim
  const filteredCariler = cariler.filter(cari => {
    const cariYaslandirma = cari.yaslandirma;
    if (!cariYaslandirma) return false;

    // Check if this cari has any amount in the selected vade dilimi
    const dilimValue = cariYaslandirma[selectedDilim as keyof typeof cariYaslandirma] || 0;
    return dilimValue > 0;
  });

  // Sort by the amount in the selected dilim
  const sortedCariler = [...filteredCariler].sort((a, b) => {
    const aValue = a.yaslandirma?.[selectedDilim as keyof typeof a.yaslandirma] || 0;
    const bValue = b.yaslandirma?.[selectedDilim as keyof typeof b.yaslandirma] || 0;
    return bValue - aValue;
  });

  const totalAmount = sortedCariler.reduce((acc, cari) => {
    return acc + (cari.yaslandirma?.[selectedDilim as keyof typeof cari.yaslandirma] || 0);
  }, 0);

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge className={`${dilimColor} px-3 py-1`}>
            {dilimLabel}
          </Badge>
          <div>
            <h3 className="font-semibold">Vade Detay Listesi</h3>
            <p className="text-sm text-muted-foreground">
              {sortedCariler.length} müşteri · Toplam: <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setFilter('vadeDilimi', null)}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title="Kapat"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {sortedCariler.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Bu vade diliminde müşteri bulunamadı</p>
        </div>
      ) : (
        <ScrollArea className="h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Ünvan / Cari Kodu</TableHead>
                <TableHead>Özel Kod</TableHead>
                <TableHead>Satış Temsilcisi</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCariler.slice(0, 50).map((cari, index) => {
                const dilimTutar = cari.yaslandirma?.[selectedDilim as keyof typeof cari.yaslandirma] || 0;
                return (
                  <TableRow key={cari._key || index} className="hover:bg-secondary/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm truncate max-w-[220px]" title={cari.cariAdi}>
                          {cari.cariAdi}
                        </p>
                        <p className="text-xs text-muted-foreground">{cari.cariKodu}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cari.ozelkod2kod && (
                          <Badge variant="outline" className="text-xs">
                            {cari.ozelkod2kod}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{cari.satiselemani || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {cari.telefon && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{cari.telefon}</span>
                          </div>
                        )}
                        {cari.eposta && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{cari.eposta}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className={`font-semibold ${selectedDilim.startsWith('vade') ? 'text-destructive' : selectedDilim === 'guncel' ? 'text-primary' : 'text-success'}`}>
                          {formatCurrency(dilimTutar)}
                        </p>
                        {cari.vadesigecentutar > 0 && selectedDilim.startsWith('gelecek') && (
                          <div className="flex items-center justify-end gap-1 text-xs text-warning">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Gecikmiş var</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {sortedCariler.length > 50 && (
            <p className="text-center text-sm text-muted-foreground py-3">
              +{sortedCariler.length - 50} daha fazla kayıt...
            </p>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
