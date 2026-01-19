// Widget Settings Modal - Widget ayar modal'ı
// Widget filtreleri ve sayfa taşıma işlemleri

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, MoveRight } from 'lucide-react';
import { 
  getWidgetById, 
  WidgetCategory, 
  WidgetFilter, 
  getPageCategories 
} from '@/lib/widgetRegistry';
import { useUserSettings } from '@/contexts/UserSettingsContext';

interface WidgetSettingsModalProps {
  widgetId: string;
  currentPage: WidgetCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WidgetSettingsModal({ 
  widgetId, 
  currentPage, 
  open, 
  onOpenChange 
}: WidgetSettingsModalProps) {
  const { getWidgetFilters, saveWidgetFilters, resetWidgetFilters, moveWidgetToPage } = useUserSettings();
  
  const widget = getWidgetById(widgetId);
  const pages = getPageCategories();
  const otherPages = pages.filter(p => p.id !== currentPage);
  
  const [filters, setFilters] = useState<WidgetFilter>({});
  const [targetPage, setTargetPage] = useState<WidgetCategory | ''>('');

  useEffect(() => {
    if (open) {
      const savedFilters = getWidgetFilters(widgetId);
      setFilters(savedFilters);
      setTargetPage('');
    }
  }, [open, widgetId, getWidgetFilters]);

  if (!widget) return null;

  const handleSave = async () => {
    await saveWidgetFilters(widgetId, filters);
    
    if (targetPage && targetPage !== currentPage) {
      await moveWidgetToPage(widgetId, currentPage, targetPage);
    }
    
    onOpenChange(false);
  };

  const handleReset = async () => {
    await resetWidgetFilters(widgetId);
    setFilters({});
  };

  const handleGorunumModu = (value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      gorunumModu: value as 'hepsi' | 'cari' | 'potansiyel' 
    }));
  };

  const handleDurum = (value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      durum: value as 'hepsi' | 'aktif' | 'pasif' 
    }));
  };

  const handleCariKartTipi = (tip: 'AL' | 'AS' | 'ST', checked: boolean) => {
    setFilters(prev => {
      const current = prev.cariKartTipi || [];
      if (checked) {
        return { ...prev, cariKartTipi: [...current, tip] };
      } else {
        return { ...prev, cariKartTipi: current.filter(t => t !== tip) };
      }
    });
  };

  const showGorunumModu = widget.availableFilters.includes('gorunumModu');
  const showDurum = widget.availableFilters.includes('durum');
  const showCariKartTipi = widget.availableFilters.includes('cariKartTipi');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⚙️ {widget.name} Ayarları
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Görünüm Modu */}
          {showGorunumModu && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">📊 Görünüm Modu</Label>
              <RadioGroup 
                value={filters.gorunumModu || 'hepsi'} 
                onValueChange={handleGorunumModu}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hepsi" id="gorunum-hepsi" />
                  <Label htmlFor="gorunum-hepsi" className="text-sm cursor-pointer">Hepsi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cari" id="gorunum-cari" />
                  <Label htmlFor="gorunum-cari" className="text-sm cursor-pointer">Cari</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="potansiyel" id="gorunum-potansiyel" />
                  <Label htmlFor="gorunum-potansiyel" className="text-sm cursor-pointer">Potansiyel</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Durum */}
          {showDurum && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">👤 Durum</Label>
              <RadioGroup 
                value={filters.durum || 'hepsi'} 
                onValueChange={handleDurum}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hepsi" id="durum-hepsi" />
                  <Label htmlFor="durum-hepsi" className="text-sm cursor-pointer">Hepsi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="aktif" id="durum-aktif" />
                  <Label htmlFor="durum-aktif" className="text-sm cursor-pointer">Aktif</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pasif" id="durum-pasif" />
                  <Label htmlFor="durum-pasif" className="text-sm cursor-pointer">Pasif</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Cari Kart Tipi */}
          {showCariKartTipi && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">🏷️ Cari Kart Tipi</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="tip-al"
                    checked={filters.cariKartTipi?.includes('AL') ?? false}
                    onCheckedChange={(checked) => handleCariKartTipi('AL', !!checked)}
                  />
                  <Label htmlFor="tip-al" className="text-sm cursor-pointer">
                    AL (Alıcı)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="tip-as"
                    checked={filters.cariKartTipi?.includes('AS') ?? false}
                    onCheckedChange={(checked) => handleCariKartTipi('AS', !!checked)}
                  />
                  <Label htmlFor="tip-as" className="text-sm cursor-pointer">
                    AS (Alıcı-Satıcı)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="tip-st"
                    checked={filters.cariKartTipi?.includes('ST') ?? false}
                    onCheckedChange={(checked) => handleCariKartTipi('ST', !!checked)}
                  />
                  <Label htmlFor="tip-st" className="text-sm cursor-pointer">
                    ST (Satıcı)
                  </Label>
                </div>
              </div>
            </div>
          )}

          {(showGorunumModu || showDurum || showCariKartTipi) && <Separator />}

          {/* Sayfaya Taşı */}
          {otherPages.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MoveRight className="w-4 h-4" />
                Sayfaya Taşı
              </Label>
              <Select value={targetPage} onValueChange={(v) => setTargetPage(v as WidgetCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sayfa seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {otherPages.map(page => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Varsayılana Dön
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
