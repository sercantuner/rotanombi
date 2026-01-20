// FieldWellItem - Power BI tarzı tek alan kartı bileşeni
// Aggregation, format, renk ve diğer ayarları içerir

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { X, Settings2, GripVertical, Hash, Type, Calendar, Palette, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AggregationType, AGGREGATION_TYPES, FORMAT_OPTIONS } from '@/lib/widgetBuilderTypes';

export interface FieldWellItemData {
  field: string;
  label?: string;
  aggregation?: AggregationType;
  format?: 'currency' | 'number' | 'percentage' | 'date' | 'text' | 'badge';
  color?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  showLabel?: boolean;
  referenceValue?: number;
  referenceLabel?: string;
}

interface FieldWellItemProps {
  item: FieldWellItemData;
  onChange: (item: FieldWellItemData) => void;
  onRemove: () => void;
  fieldType?: 'text' | 'number' | 'date' | 'boolean';
  showAggregation?: boolean;
  showColor?: boolean;
  showFormat?: boolean;
  isDragging?: boolean;
  className?: string;
}

// Renk seçenekleri
const COLOR_OPTIONS = [
  { value: '#3b82f6', name: 'Mavi' },
  { value: '#10b981', name: 'Yeşil' },
  { value: '#f59e0b', name: 'Turuncu' },
  { value: '#ef4444', name: 'Kırmızı' },
  { value: '#8b5cf6', name: 'Mor' },
  { value: '#ec4899', name: 'Pembe' },
  { value: '#06b6d4', name: 'Cyan' },
  { value: '#84cc16', name: 'Lime' },
  { value: '#f97316', name: 'Amber' },
  { value: '#6366f1', name: 'İndigo' },
];

// Alan tipi ikonu
const FieldTypeIcon = ({ type }: { type?: string }) => {
  switch (type) {
    case 'number': return <Hash className="h-3 w-3" />;
    case 'date': return <Calendar className="h-3 w-3" />;
    default: return <Type className="h-3 w-3" />;
  }
};

export function FieldWellItem({
  item,
  onChange,
  onRemove,
  fieldType = 'text',
  showAggregation = true,
  showColor = false,
  showFormat = true,
  isDragging = false,
  className,
}: FieldWellItemProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleChange = (updates: Partial<FieldWellItemData>) => {
    onChange({ ...item, ...updates });
  };

  const selectedColor = item.color || COLOR_OPTIONS[0].value;
  const displayLabel = item.label || item.field;
  const selectedAgg = AGGREGATION_TYPES.find(a => a.id === item.aggregation);
  const selectedFormat = FORMAT_OPTIONS.find(f => f.id === item.format);

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 p-2 rounded-lg border bg-card transition-all",
        isDragging && "opacity-50 shadow-lg",
        "hover:border-primary/50 hover:shadow-sm",
        className
      )}
    >
      {/* Drag handle */}
      <div className="cursor-grab opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Alan tipi ikonu */}
      <div className="flex items-center justify-center w-6 h-6 rounded bg-secondary/50">
        <FieldTypeIcon type={fieldType} />
      </div>

      {/* Alan adı */}
      <span className="flex-1 text-sm font-medium truncate min-w-0">
        {displayLabel}
      </span>

      {/* Hızlı ayarlar - Aggregation */}
      {showAggregation && (
        <Select
          value={item.aggregation || 'sum'}
          onValueChange={(v) => handleChange({ aggregation: v as AggregationType })}
        >
          <SelectTrigger className="h-7 w-[80px] text-xs border-dashed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATION_TYPES.map(agg => (
              <SelectItem key={agg.id} value={agg.id} className="text-xs">
                {agg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Hızlı ayarlar - Format */}
      {showFormat && (
        <Select
          value={item.format || 'number'}
          onValueChange={(v) => handleChange({ format: v as FieldWellItemData['format'] })}
        >
          <SelectTrigger className="h-7 w-[70px] text-xs border-dashed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map(fmt => (
              <SelectItem key={fmt.id} value={fmt.id} className="text-xs">
                {fmt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Renk seçici */}
      {showColor && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-dashed"
            >
              <div
                className="w-4 h-4 rounded-full border"
                style={{ backgroundColor: selectedColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color.value}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all hover:scale-110",
                    selectedColor === color.value ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleChange({ color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Gelişmiş ayarlar */}
      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="font-medium text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Alan Ayarları
            </div>

            <div className="space-y-3">
              {/* Etiket */}
              <div className="space-y-1.5">
                <Label className="text-xs">Görüntüleme Adı</Label>
                <Input
                  value={item.label || ''}
                  onChange={(e) => handleChange({ label: e.target.value })}
                  placeholder={item.field}
                  className="h-8 text-sm"
                />
              </div>

              {/* Prefix/Suffix */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Prefix</Label>
                  <Input
                    value={item.prefix || ''}
                    onChange={(e) => handleChange({ prefix: e.target.value })}
                    placeholder="₺"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Suffix</Label>
                  <Input
                    value={item.suffix || ''}
                    onChange={(e) => handleChange({ suffix: e.target.value })}
                    placeholder="%"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Ondalık */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ondalık Basamak</Label>
                <Select
                  value={String(item.decimals ?? 2)}
                  onValueChange={(v) => handleChange({ decimals: parseInt(v) })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Referans değer */}
              <div className="space-y-1.5">
                <Label className="text-xs">Referans Değer (Çizgi)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={item.referenceValue ?? ''}
                    onChange={(e) => handleChange({ referenceValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Değer"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={item.referenceLabel || ''}
                    onChange={(e) => handleChange({ referenceLabel: e.target.value })}
                    placeholder="Etiket"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Kaldır butonu */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
