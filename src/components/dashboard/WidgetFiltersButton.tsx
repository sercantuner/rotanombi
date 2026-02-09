// WidgetFiltersButton - Dinamik filtre/parametre UI
// Widget'ın builder_config'indeki widgetFilters ve widgetParameters tanımlarına göre UI üretir

import { useState, useMemo } from 'react';
import { Filter, FilterX, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WidgetLocalFilters } from '@/hooks/useWidgetLocalFilters';
import { WidgetFilterDef, WidgetParamDef } from '@/lib/widgetBuilderTypes';
import { cn } from '@/lib/utils';

interface WidgetFiltersButtonProps {
  filters: WidgetLocalFilters;
  onFiltersChange: (filters: WidgetLocalFilters) => void;
  onReset: () => void;
  activeFilterCount: number;
  widgetFilters?: WidgetFilterDef[];
  widgetParameters?: WidgetParamDef[];
  className?: string;
}

// Tek bir filtre/parametre alanını render eden bileşen
function DynamicField({ 
  def, 
  value, 
  onChange 
}: { 
  def: WidgetFilterDef | WidgetParamDef; 
  value: any; 
  onChange: (val: any) => void;
}) {
  switch (def.type) {
    case 'multi-select':
      return (
        <div className="flex flex-wrap gap-2">
          {(def.options || []).map(opt => (
            <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={(value || []).includes(opt.value)}
                onCheckedChange={(checked) => {
                  const current = value || [];
                  onChange(checked 
                    ? [...current, opt.value] 
                    : current.filter((v: any) => v !== opt.value)
                  );
                }}
              />
              <span className="text-xs">{opt.label}</span>
            </label>
          ))}
        </div>
      );

    case 'dropdown':
      return (
        <Select value={value ?? (def.defaultValue || '')} onValueChange={onChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Seçin..." />
          </SelectTrigger>
          <SelectContent>
            {(def.options || []).map(opt => (
              <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'toggle':
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={value ?? def.defaultValue ?? false}
            onCheckedChange={onChange}
          />
          <span className="text-xs text-muted-foreground">
            {value ? 'Açık' : 'Kapalı'}
          </span>
        </div>
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value ?? def.defaultValue ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          min={def.min}
          max={def.max}
          className="h-7 text-xs"
          placeholder={def.defaultValue !== undefined ? `Varsayılan: ${def.defaultValue}` : ''}
        />
      );

    case 'text':
      return (
        <Input
          type="text"
          value={value ?? def.defaultValue ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-7 text-xs"
          placeholder={def.defaultValue || ''}
        />
      );

    case 'range':
      return (
        <div className="space-y-1">
          <Slider
            value={[value ?? def.defaultValue ?? def.min ?? 0]}
            onValueChange={([v]) => onChange(v)}
            min={def.min ?? 0}
            max={def.max ?? 100}
            step={1}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{def.min ?? 0}</span>
            <span className="font-medium text-foreground">{value ?? def.defaultValue ?? def.min ?? 0}</span>
            <span>{def.max ?? 100}</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function WidgetFiltersButton({
  filters,
  onFiltersChange,
  onReset,
  activeFilterCount,
  widgetFilters,
  widgetParameters,
  className,
}: WidgetFiltersButtonProps) {
  const [open, setOpen] = useState(false);

  const hasFilters = widgetFilters && widgetFilters.length > 0;
  const hasParams = widgetParameters && widgetParameters.length > 0;
  const hasContent = hasFilters || hasParams;

  // Eğer widget tanımlı filtre/parametre yoksa buton gösterme
  if (!hasContent) return null;

  const handleFieldChange = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
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
            <SlidersHorizontal className="w-3 h-3 md:w-4 md:h-4" />
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
            <span className="text-sm font-medium">Ayarlar</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onReset}>
                <RotateCcw className="w-3 h-3" />
                Sıfırla
              </Button>
            )}
          </div>

          {/* Filtreler Bölümü */}
          {hasFilters && (
            <>
              <Separator />
              <div className="space-y-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Filtreler
                </span>
                {widgetFilters!.map(def => (
                  <div key={def.key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{def.label}</Label>
                    <DynamicField
                      def={def}
                      value={filters[def.key]}
                      onChange={(val) => handleFieldChange(def.key, val)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Parametreler Bölümü */}
          {hasParams && (
            <>
              <Separator />
              <div className="space-y-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  Parametreler
                </span>
                {widgetParameters!.map(def => (
                  <div key={def.key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{def.label}</Label>
                    <DynamicField
                      def={def}
                      value={filters[def.key]}
                      onChange={(val) => handleFieldChange(def.key, val)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
