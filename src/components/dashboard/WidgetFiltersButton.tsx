// WidgetFiltersButton - Her widget için standart filtre/parametre butonu
// Popover içinde widget'a özgü filtre alanları gösterir

import { useState, useMemo } from 'react';
import { Filter, FilterX, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WidgetLocalFilters } from '@/hooks/useWidgetLocalFilters';
import { cn } from '@/lib/utils';

interface WidgetFiltersButtonProps {
  filters: WidgetLocalFilters;
  onFiltersChange: (filters: WidgetLocalFilters) => void;
  onReset: () => void;
  activeFilterCount: number;
  availableFilters?: string[]; // Widget'ın desteklediği filtre tipleri
  className?: string;
  compact?: boolean;
}

// Tüm standart filtre blokları
const FILTER_BLOCKS: Record<string, { label: string; icon: string }> = {
  cariKartTipi: { label: 'Kart Tipi', icon: 'Users' },
  gorunumModu: { label: 'Görünüm', icon: 'Eye' },
  durum: { label: 'Durum', icon: 'ToggleLeft' },
  satisTemsilcisi: { label: 'Satış Temsilcisi', icon: 'User' },
  sube: { label: 'Şube', icon: 'Building2' },
  depo: { label: 'Depo', icon: 'Warehouse' },
  ozelkod1: { label: 'Özel Kod 1', icon: 'Hash' },
  ozelkod2: { label: 'Özel Kod 2', icon: 'Hash' },
  ozelkod3: { label: 'Özel Kod 3', icon: 'Hash' },
};

export function WidgetFiltersButton({
  filters,
  onFiltersChange,
  onReset,
  activeFilterCount,
  availableFilters,
  className,
  compact = false,
}: WidgetFiltersButtonProps) {
  const [open, setOpen] = useState(false);
  
  // Hangi filtre blokları gösterilecek
  const visibleFilters = useMemo(() => {
    if (availableFilters && availableFilters.length > 0) {
      return availableFilters;
    }
    // Varsayılan: tüm standart filtreler
    return ['cariKartTipi', 'gorunumModu', 'durum'];
  }, [availableFilters]);

  const handleCariKartTipiChange = (value: string, checked: boolean) => {
    const current = filters.cariKartTipi || [];
    const updated = checked
      ? [...current, value]
      : current.filter(t => t !== value);
    onFiltersChange({ ...filters, cariKartTipi: updated });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 md:h-7 md:w-7 bg-background/80 backdrop-blur-sm hover:bg-background relative',
            activeFilterCount > 0 && 'text-primary',
            className
          )}
        >
          {activeFilterCount > 0 ? (
            <FilterX className="w-3 h-3 md:w-4 md:h-4" />
          ) : (
            <Filter className="w-3 h-3 md:w-4 md:h-4" />
          )}
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-medium">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-72 max-h-[60vh] overflow-y-auto p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filtreler</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onReset}>
                <RotateCcw className="w-3 h-3" />
                Sıfırla
              </Button>
            )}
          </div>
          
          <Separator />

          {/* Cari Kart Tipi */}
          {visibleFilters.includes('cariKartTipi') && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Kart Tipi</Label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'AL', label: 'Alıcı' },
                  { value: 'AS', label: 'Al-Sat' },
                  { value: 'ST', label: 'Satıcı' },
                ].map(item => (
                  <label key={item.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={(filters.cariKartTipi || []).includes(item.value)}
                      onCheckedChange={(checked) => handleCariKartTipiChange(item.value, checked as boolean)}
                    />
                    <span className="text-xs">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Görünüm Modu */}
          {visibleFilters.includes('gorunumModu') && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Görünüm</Label>
              <RadioGroup
                value={filters.gorunumModu || 'hepsi'}
                onValueChange={(value) => onFiltersChange({ ...filters, gorunumModu: value as any })}
                className="flex gap-3"
              >
                {[
                  { value: 'hepsi', label: 'Hepsi' },
                  { value: 'cari', label: 'Cari' },
                  { value: 'potansiyel', label: 'Potansiyel' },
                ].map(item => (
                  <label key={item.value} className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value={item.value} />
                    <span className="text-xs">{item.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Durum */}
          {visibleFilters.includes('durum') && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Durum</Label>
              <RadioGroup
                value={filters.durum || 'hepsi'}
                onValueChange={(value) => onFiltersChange({ ...filters, durum: value as any })}
                className="flex gap-3"
              >
                {[
                  { value: 'hepsi', label: 'Hepsi' },
                  { value: 'aktif', label: 'Aktif' },
                  { value: 'pasif', label: 'Pasif' },
                ].map(item => (
                  <label key={item.value} className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value={item.value} />
                    <span className="text-xs">{item.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
