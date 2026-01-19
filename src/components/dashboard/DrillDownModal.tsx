// DrillDown Modal - Grafik elemanına tıklandığında detay listesi gösterir

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrillDownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  data: any[];
  displayFields?: string[];
  primaryField?: string;
  valueField?: string;
  formatValue?: (value: any) => string;
}

// Değer formatlama
function defaultFormatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1_000_000) {
      return `₺${(value / 1_000_000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1_000) {
      return `₺${(value / 1_000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  }
  return String(value);
}

// Alan adını okunabilir hale getir
function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    cariadi: 'Cari Adı',
    carikod: 'Cari Kod',
    toplambakiye: 'Toplam Bakiye',
    sehir: 'Şehir',
    telefon: 'Telefon',
    email: 'E-posta',
    ozelkod1: 'Özel Kod 1',
    ozelkod2: 'Özel Kod 2',
    ozelkod3: 'Özel Kod 3',
    sektor: 'Sektör',
    kaynak: 'Kaynak',
    aktif: 'Aktif',
    potansiyel: 'Potansiyel',
    carikarttipi: 'Cari Kart Tipi',
    vadesigecentutar: 'Vadesi Geçen Tutar',
    cariyedonusmetarihi: 'Cariye Dönüşüm Tarihi',
    sonislemtarihi: 'Son İşlem Tarihi',
  };
  return fieldMap[field.toLowerCase()] || field;
}

export function DrillDownModal({
  open,
  onOpenChange,
  title,
  subtitle,
  data,
  displayFields,
  primaryField = 'cariadi',
  valueField = 'toplambakiye',
  formatValue = defaultFormatValue,
}: DrillDownModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Görüntülenecek alanları belirle
  const fieldsToDisplay = useMemo(() => {
    if (displayFields && displayFields.length > 0) return displayFields;
    if (data.length === 0) return [];
    
    // İlk kayıttan alanları al, önemli alanları öne koy
    const allFields = Object.keys(data[0]);
    const priorityFields = ['cariadi', 'carikod', 'toplambakiye', 'sehir', 'telefon'];
    const orderedFields = [
      ...priorityFields.filter(f => allFields.includes(f)),
      ...allFields.filter(f => !priorityFields.includes(f)),
    ];
    return orderedFields.slice(0, 6); // En fazla 6 alan
  }, [data, displayFields]);

  // Filtrelenmiş veri
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery]);

  // Sayfalama
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Toplam değer
  const totalValue = useMemo(() => {
    if (!valueField) return null;
    return data.reduce((sum, item) => {
      const val = item[valueField];
      return sum + (typeof val === 'number' ? val : parseFloat(val) || 0);
    }, 0);
  }, [data, valueField]);

  // CSV Export
  const handleExport = () => {
    const headers = fieldsToDisplay.map(f => formatFieldName(f)).join(',');
    const rows = filteredData.map(item => 
      fieldsToDisplay.map(f => `"${String(item[f] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/\s+/g, '_')}_detay.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Badge variant="secondary" className="ml-2">
              {filteredData.length} kayıt
            </Badge>
          </DialogTitle>
          {subtitle && (
            <DialogDescription>{subtitle}</DialogDescription>
          )}
        </DialogHeader>

        {/* Özet Bilgi */}
        {totalValue !== null && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Toplam Değer:</span>
            <span className="text-lg font-semibold">{formatValue(totalValue)}</span>
          </div>
        )}

        {/* Arama ve Export */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>

        {/* Veri Listesi */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-2">
            {paginatedData.map((item, idx) => (
              <Card key={idx} className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Ana Bilgi */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item[primaryField] || `Kayıt ${idx + 1}`}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {fieldsToDisplay
                          .filter(f => f !== primaryField && f !== valueField)
                          .slice(0, 4)
                          .map(field => (
                            <span key={field} className="text-xs text-muted-foreground">
                              <span className="font-medium">{formatFieldName(field)}:</span>{' '}
                              {String(item[field] || '-')}
                            </span>
                          ))}
                      </div>
                    </div>
                    {/* Değer */}
                    {valueField && item[valueField] !== undefined && (
                      <div className="text-right shrink-0">
                        <p className={cn(
                          'font-semibold',
                          typeof item[valueField] === 'number' && item[valueField] < 0 
                            ? 'text-destructive' 
                            : 'text-foreground'
                        )}>
                          {formatValue(item[valueField])}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {paginatedData.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                Kayıt bulunamadı
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              Sayfa {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
