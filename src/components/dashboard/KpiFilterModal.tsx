// KPI Widget Filtre Modal Bileşeni
// Widget bazlı özel filtreleme ayarları

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface KpiFilter {
  gorunumModu: 'hepsi' | 'cari' | 'potansiyel';
  durum: 'hepsi' | 'aktif' | 'pasif';
  cariKartTipi: ('AL' | 'AS' | 'ST')[];
  ozelKod1?: string;
  ozelKod2?: string;
  ozelKod3?: string;
}

interface KpiFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: string;
  widgetName: string;
  containerWidgetId?: string;
  currentFilters?: KpiFilter;
  onFiltersChange?: (filters: KpiFilter) => void;
}

const DEFAULT_FILTERS: KpiFilter = {
  gorunumModu: 'hepsi',
  durum: 'hepsi',
  cariKartTipi: ['AL', 'AS', 'ST'],
};

export function KpiFilterModal({
  open,
  onOpenChange,
  widgetId,
  widgetName,
  containerWidgetId,
  currentFilters,
  onFiltersChange,
}: KpiFilterModalProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<KpiFilter>(currentFilters || DEFAULT_FILTERS);
  const [isSaving, setIsSaving] = useState(false);
  const [ozelKodOptions, setOzelKodOptions] = useState<{ok1: string[], ok2: string[], ok3: string[]}>({
    ok1: [], ok2: [], ok3: []
  });

  // Mevcut filtreleri yükle
  useEffect(() => {
    if (currentFilters) {
      setFilters(currentFilters);
    } else {
      setFilters(DEFAULT_FILTERS);
    }
  }, [currentFilters, open]);

  // Özel kod seçeneklerini yükle (örnek)
  useEffect(() => {
    // Bu özellik ileride DIA'dan çekilebilir
    setOzelKodOptions({
      ok1: ['PLATIN', 'GOLD', 'SILVER', 'BRONZE'],
      ok2: ['VIP', 'STANDART', 'YENİ'],
      ok3: ['İSTANBUL', 'ANKARA', 'İZMİR', 'ANTALYA']
    });
  }, []);

  const handleCariKartTipiChange = (value: 'AL' | 'AS' | 'ST', checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      cariKartTipi: checked
        ? [...prev.cariKartTipi, value]
        : prev.cariKartTipi.filter(t => t !== value)
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    try {
      // Container widget ayarlarına kaydet
      if (containerWidgetId) {
        const { error } = await supabase
          .from('container_widgets')
          .update({
            settings: { filters } as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', containerWidgetId);

        if (error) throw error;
      } else {
        // user_widget_filters tablosuna kaydet
        const { error } = await supabase
          .from('user_widget_filters')
          .upsert({
            user_id: user.id,
            widget_id: widgetId,
            filters: filters as any,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,widget_id'
          });

        if (error) throw error;
      }

      onFiltersChange?.(filters);
      toast.success('Filtreler kaydedildi');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving filters:', error);
      toast.error('Filtreler kaydedilemedi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Widget Filtreleri</span>
            <span className="text-sm font-normal text-muted-foreground">- {widgetName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Görünüm Modu */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Görünüm Modu</Label>
            <RadioGroup
              value={filters.gorunumModu}
              onValueChange={(value) => setFilters(prev => ({ ...prev, gorunumModu: value as any }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hepsi" id="gorunum-hepsi" />
                <Label htmlFor="gorunum-hepsi" className="cursor-pointer">Hepsi</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cari" id="gorunum-cari" />
                <Label htmlFor="gorunum-cari" className="cursor-pointer">Cari</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="potansiyel" id="gorunum-potansiyel" />
                <Label htmlFor="gorunum-potansiyel" className="cursor-pointer">Potansiyel</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Durum */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Durum</Label>
            <RadioGroup
              value={filters.durum}
              onValueChange={(value) => setFilters(prev => ({ ...prev, durum: value as any }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hepsi" id="durum-hepsi" />
                <Label htmlFor="durum-hepsi" className="cursor-pointer">Hepsi</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aktif" id="durum-aktif" />
                <Label htmlFor="durum-aktif" className="cursor-pointer">Aktif</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pasif" id="durum-pasif" />
                <Label htmlFor="durum-pasif" className="cursor-pointer">Pasif</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Cari Kart Tipi */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cari Kart Tipi</Label>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cari-al"
                  checked={filters.cariKartTipi.includes('AL')}
                  onCheckedChange={(checked) => handleCariKartTipiChange('AL', checked as boolean)}
                />
                <Label htmlFor="cari-al" className="cursor-pointer">AL (Alıcı)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cari-as"
                  checked={filters.cariKartTipi.includes('AS')}
                  onCheckedChange={(checked) => handleCariKartTipiChange('AS', checked as boolean)}
                />
                <Label htmlFor="cari-as" className="cursor-pointer">AS (Alıcı/Satıcı)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cari-st"
                  checked={filters.cariKartTipi.includes('ST')}
                  onCheckedChange={(checked) => handleCariKartTipiChange('ST', checked as boolean)}
                />
                <Label htmlFor="cari-st" className="cursor-pointer">ST (Satıcı)</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Özel Kod Filtreleri */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Özel Kod Filtreleri</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Özel Kod 1</Label>
                <Select
                  value={filters.ozelKod1 || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    ozelKod1: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hepsi</SelectItem>
                    {ozelKodOptions.ok1.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Özel Kod 2</Label>
                <Select
                  value={filters.ozelKod2 || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    ozelKod2: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hepsi</SelectItem>
                    {ozelKodOptions.ok2.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Özel Kod 3</Label>
                <Select
                  value={filters.ozelKod3 || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    ozelKod3: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hepsi</SelectItem>
                    {ozelKodOptions.ok3.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleReset}>
            Sıfırla
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
