// DrillDown Modal - KPI kartlarına tıklandığında detay listesi gösterir
// Standart: w-[50vw] genişlik, max-h-[80vh] yükseklik, kompakt tasarım

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <DialogContent className="w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0">
        {/* Header - 3 bölgeli düzen: sol (başlık+badge) | orta (bilgiler) | sağ (X butonu - DialogContent tarafından sağlanır) */}
        <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0 gap-4 pr-12">
          <div className="flex items-center gap-2 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
              {filteredData.length} kayıt
            </Badge>
          </div>
          {totalValue !== null && (
            <div className="flex-1 text-right">
              <span className="text-sm font-bold">{formatValue(totalValue)}</span>
            </div>
          )}
          {subtitle && (
            <DialogDescription className="text-[10px] text-muted-foreground sr-only">{subtitle}</DialogDescription>
          )}
        </div>

        {/* Content Area with Scroll */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* Arama ve Export */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Ara..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 h-8 text-xs"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs px-2">
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>

          {/* Veri Listesi */}
          <div className="space-y-1.5">
            {paginatedData.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-start justify-between p-2 rounded border border-border hover:bg-muted/50 transition-colors"
              >
                {/* Ana Bilgi */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {item[primaryField] || `Kayıt ${idx + 1}`}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {fieldsToDisplay
                      .filter(f => f !== primaryField && f !== valueField)
                      .slice(0, 4)
                      .map(field => (
                        <span key={field} className="text-[10px] text-muted-foreground">
                          <span className="font-medium">{formatFieldName(field)}:</span>{' '}
                          {String(item[field] || '-')}
                        </span>
                      ))}
                  </div>
                </div>
                {/* Değer */}
                {valueField && item[valueField] !== undefined && (
                  <div className="text-right shrink-0 ml-2">
                    <p className={cn(
                      'text-xs font-semibold',
                      typeof item[valueField] === 'number' && item[valueField] < 0 
                        ? 'text-destructive' 
                        : 'text-foreground'
                    )}>
                      {formatValue(item[valueField])}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {paginatedData.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-xs">
                Kayıt bulunamadı
              </div>
            )}
          </div>
        </div>

        {/* Footer - Sayfalama */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-2 border-t border-border flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">
              Sayfa {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
