import React, { useState } from 'react';
import { AlertTriangle, Package, ShoppingCart, ChevronRight, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StokUyari {
  stokKodu: string;
  stokAdi: string;
  mevcutStok: number;
  minStok: number;
  birim: string;
  durum: 'kritik' | 'dusuk' | 'yakin' | 'siparis';
}

// Mock data - ileride DIA'dan çekilecek
const mockStokUyarilari: StokUyari[] = [
  { stokKodu: 'STK-001', stokAdi: 'Laptop Model X Pro', mevcutStok: 2, minStok: 10, birim: 'Adet', durum: 'kritik' },
  { stokKodu: 'STK-002', stokAdi: 'USB-C Kablo 2m', mevcutStok: 15, minStok: 50, birim: 'Adet', durum: 'dusuk' },
  { stokKodu: 'STK-003', stokAdi: 'Wireless Mouse', mevcutStok: 8, minStok: 20, birim: 'Adet', durum: 'dusuk' },
  { stokKodu: 'STK-004', stokAdi: 'Monitor 27" 4K', mevcutStok: 5, minStok: 15, birim: 'Adet', durum: 'yakin' },
  { stokKodu: 'STK-005', stokAdi: 'Keyboard Mech. RGB', mevcutStok: 0, minStok: 25, birim: 'Adet', durum: 'kritik' },
  { stokKodu: 'STK-006', stokAdi: 'Webcam HD 1080p', mevcutStok: 3, minStok: 10, birim: 'Adet', durum: 'kritik' },
  { stokKodu: 'STK-007', stokAdi: 'SSD 1TB NVMe', mevcutStok: 12, minStok: 30, birim: 'Adet', durum: 'dusuk' },
  { stokKodu: 'STK-008', stokAdi: 'RAM DDR5 32GB', mevcutStok: 0, minStok: 20, birim: 'Adet', durum: 'siparis' },
];

interface Props {
  isLoading?: boolean;
}

export function KritikStokUyarilari({ isLoading }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const stokUyarilari = mockStokUyarilari;

  const kritikSayisi = stokUyarilari.filter(s => s.durum === 'kritik').length;
  const dusukSayisi = stokUyarilari.filter(s => s.durum === 'dusuk').length;
  const yakinSayisi = stokUyarilari.filter(s => s.durum === 'yakin').length;
  const siparisSayisi = stokUyarilari.filter(s => s.durum === 'siparis').length;

  const getDurumStyle = (durum: StokUyari['durum']) => {
    switch (durum) {
      case 'kritik':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'dusuk':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'yakin':
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
      case 'siparis':
        return 'bg-primary/20 text-primary border-primary/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDurumText = (durum: StokUyari['durum']) => {
    switch (durum) {
      case 'kritik': return 'KRİTİK';
      case 'dusuk': return 'DÜŞÜK';
      case 'yakin': return 'YAKINDA';
      case 'siparis': return 'SİPARİŞTE';
      default: return durum;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded border border-border p-2 md:p-3 animate-pulse">
        <div className="h-5 bg-muted rounded w-40 mb-2" />
        <div className="space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const displayList = showAll ? stokUyarilari : stokUyarilari.slice(0, 5);

  return (
    <>
      <div className="bg-card rounded border border-border p-2 md:p-3">
        {/* Header - Tıklanabilir */}
        <div 
          className="flex items-center justify-between mb-2 cursor-pointer hover:bg-muted/50 -mx-2 -mt-2 px-2 pt-2 pb-1 rounded transition-colors"
          onClick={() => setIsPopupOpen(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Kritik Stok Uyarıları</h3>
              <p className="text-[10px] text-muted-foreground">Tıkla: Tüm stokları görüntüle</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="font-medium">{stokUyarilari.length} ürün</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Summary Pills */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/20 border border-destructive/30">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-[10px] font-medium text-destructive">{kritikSayisi} Kritik</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-warning/20 border border-warning/30">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            <span className="text-[10px] font-medium text-warning">{dusukSayisi} Düşük</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400">{yakinSayisi} Yakında</span>
          </div>
          {siparisSayisi > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/20 border border-primary/30">
              <ShoppingCart className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-primary">{siparisSayisi} Siparişte</span>
            </div>
          )}
        </div>

        {/* Stock List */}
        <ScrollArea className={showAll ? 'h-48' : 'max-h-48'}>
          <div className="space-y-1.5">
            {displayList.map((stok) => (
              <div 
                key={stok.stokKodu}
                className={`flex items-center justify-between p-2 rounded border ${getDurumStyle(stok.durum)} transition-all hover:scale-[1.005]`}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{stok.stokAdi}</p>
                    <p className="text-[10px] opacity-80">{stok.stokKodu}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-bold">{stok.mevcutStok} / {stok.minStok}</p>
                    <p className="text-[10px] opacity-80">{stok.birim}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-background/50">
                    {getDurumText(stok.durum)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Show More */}
        {stokUyarilari.length > 5 && (
          <button 
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
          >
            {showAll ? 'Daha az göster' : `Tümünü göster (${stokUyarilari.length})`}
            <ChevronRight className={`w-3 h-3 transition-transform ${showAll ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>

      {/* Popup Modal - KPI Standartlarına Uygun */}
      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent 
          className="w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded flex items-center justify-center bg-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold">Kritik Stok Uyarıları</DialogTitle>
                <p className="text-[10px] text-muted-foreground">{stokUyarilari.length} ürün listeleniyor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Summary Pills in Header */}
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/20 text-destructive font-medium">
                  {kritikSayisi} Kritik
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-warning/20 text-warning font-medium">
                  {dusukSayisi} Düşük
                </span>
              </div>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1.5">
              {stokUyarilari.map((stok) => (
                <div 
                  key={stok.stokKodu}
                  className={`flex items-center justify-between p-2 rounded border ${getDurumStyle(stok.durum)} transition-all hover:scale-[1.005]`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{stok.stokAdi}</p>
                      <p className="text-[10px] opacity-80">{stok.stokKodu}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold">{stok.mevcutStok} / {stok.minStok}</p>
                      <p className="text-[10px] opacity-80">{stok.birim}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded ${getDurumStyle(stok.durum)}`}>
                      {getDurumText(stok.durum)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-2 border-t border-border bg-muted/30">
            <p className="text-[10px] text-muted-foreground">
              Toplam: {kritikSayisi} kritik, {dusukSayisi} düşük, {yakinSayisi} yakında, {siparisSayisi} siparişte
            </p>
            <button 
              onClick={() => setIsPopupOpen(false)}
              className="text-[10px] px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Kapat
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
