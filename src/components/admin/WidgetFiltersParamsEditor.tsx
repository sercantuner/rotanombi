// Widget Filtre ve Parametre Görsel Editörü
// Widget.filters ve Widget.parameters dizilerini görsel olarak yönetir

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Filter, SlidersHorizontal, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetFilterDef, WidgetParamDef } from '@/lib/widgetBuilderTypes';

const FILTER_TYPES = [
  { value: 'multi-select', label: 'Çoklu Seçim', desc: 'Checkbox listesi' },
  { value: 'dropdown', label: 'Açılır Liste', desc: 'Tek seçim' },
  { value: 'toggle', label: 'Aç/Kapa', desc: 'Boolean switch' },
  { value: 'number', label: 'Sayı', desc: 'Sayısal girdi' },
  { value: 'text', label: 'Metin', desc: 'Metin girdi' },
  { value: 'range', label: 'Aralık', desc: 'Min-Max slider' },
];

const PARAM_TYPES = [
  { value: 'dropdown', label: 'Açılır Liste', desc: 'Tek seçim' },
  { value: 'toggle', label: 'Aç/Kapa', desc: 'Boolean switch' },
  { value: 'number', label: 'Sayı', desc: 'Sayısal girdi' },
  { value: 'text', label: 'Metin', desc: 'Metin girdi' },
  { value: 'range', label: 'Aralık', desc: 'Min-Max slider' },
];

interface FilterItemEditorProps {
  item: WidgetFilterDef | WidgetParamDef;
  onChange: (item: WidgetFilterDef | WidgetParamDef) => void;
  onDelete: () => void;
  typeOptions: typeof FILTER_TYPES;
}

function FilterItemEditor({ item, onChange, onDelete, typeOptions }: FilterItemEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const needsOptions = item.type === 'multi-select' || item.type === 'dropdown';
  const needsMinMax = item.type === 'range' || item.type === 'number';
  const [newOptValue, setNewOptValue] = useState('');
  const [newOptLabel, setNewOptLabel] = useState('');

  return (
    <div className="border rounded-lg p-2.5 space-y-2 bg-card">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Input
              value={item.key}
              onChange={(e) => onChange({ ...item, key: e.target.value.replace(/\s/g, '') })}
              className="h-6 text-xs font-mono flex-1"
              placeholder="key"
            />
            <Input
              value={item.label}
              onChange={(e) => onChange({ ...item, label: e.target.value })}
              className="h-6 text-xs flex-1"
              placeholder="Etiket"
            />
          </div>
        </div>
        <Select value={item.type} onValueChange={(val) => onChange({ ...item, type: val as any })}>
          <SelectTrigger className="h-6 text-xs w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-2 pt-1 pl-6">
          {/* Default value */}
          {item.type === 'toggle' ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24">Varsayılan:</Label>
              <Switch
                checked={item.defaultValue ?? false}
                onCheckedChange={(val) => onChange({ ...item, defaultValue: val })}
              />
            </div>
          ) : item.type !== 'multi-select' && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24">Varsayılan:</Label>
              <Input
                value={item.defaultValue ?? ''}
                onChange={(e) => onChange({ ...item, defaultValue: e.target.value || undefined })}
                className="h-6 text-xs flex-1"
                placeholder="Boş bırakılabilir"
              />
            </div>
          )}

          {/* Min/Max for range & number */}
          {needsMinMax && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24">Min / Max:</Label>
              <Input
                type="number"
                value={item.min ?? ''}
                onChange={(e) => onChange({ ...item, min: e.target.value ? Number(e.target.value) : undefined })}
                className="h-6 text-xs w-20"
                placeholder="Min"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="number"
                value={item.max ?? ''}
                onChange={(e) => onChange({ ...item, max: e.target.value ? Number(e.target.value) : undefined })}
                className="h-6 text-xs w-20"
                placeholder="Max"
              />
            </div>
          )}

          {/* Options for multi-select & dropdown */}
          {needsOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Seçenekler:</Label>
              <div className="flex flex-wrap gap-1">
                {(item.options || []).map((opt, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => {
                      const newOpts = [...(item.options || [])];
                      newOpts.splice(i, 1);
                      onChange({ ...item, options: newOpts });
                    }}
                  >
                    {opt.label} ({opt.value})
                    <Trash2 className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  value={newOptValue}
                  onChange={(e) => setNewOptValue(e.target.value)}
                  className="h-6 text-xs flex-1"
                  placeholder="Değer"
                />
                <Input
                  value={newOptLabel}
                  onChange={(e) => setNewOptLabel(e.target.value)}
                  className="h-6 text-xs flex-1"
                  placeholder="Etiket"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  disabled={!newOptValue.trim()}
                  onClick={() => {
                    const opts = [...(item.options || []), { value: newOptValue.trim(), label: newOptLabel.trim() || newOptValue.trim() }];
                    onChange({ ...item, options: opts });
                    setNewOptValue('');
                    setNewOptLabel('');
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface WidgetFiltersParamsEditorProps {
  filters: WidgetFilterDef[];
  parameters: WidgetParamDef[];
  onFiltersChange: (filters: WidgetFilterDef[]) => void;
  onParametersChange: (params: WidgetParamDef[]) => void;
}

export function WidgetFiltersParamsEditor({ filters, parameters, onFiltersChange, onParametersChange }: WidgetFiltersParamsEditorProps) {
  const addFilter = () => {
    const newKey = `filter_${filters.length + 1}`;
    onFiltersChange([...filters, { key: newKey, label: 'Yeni Filtre', type: 'dropdown', options: [] }]);
  };

  const addParameter = () => {
    const newKey = `param_${parameters.length + 1}`;
    onParametersChange([...parameters, { key: newKey, label: 'Yeni Parametre', type: 'dropdown', options: [] }]);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-1">
        {/* Filtreler Bölümü */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filtreler
              <Badge variant="secondary" className="text-[10px] ml-1">{filters.length}</Badge>
            </span>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={addFilter}>
              <Plus className="h-3 w-3" />
              Filtre Ekle
            </Button>
          </div>

          {filters.length === 0 ? (
            <div className="border border-dashed rounded-lg p-4 text-center">
              <Filter className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Henüz filtre tanımlanmamış</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Kullanıcıların veriyi filtrelemesi için filtre ekleyin</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filters.map((f, i) => (
                <FilterItemEditor
                  key={i}
                  item={f}
                  typeOptions={FILTER_TYPES}
                  onChange={(updated) => {
                    const newFilters = [...filters];
                    newFilters[i] = updated as WidgetFilterDef;
                    onFiltersChange(newFilters);
                  }}
                  onDelete={() => {
                    onFiltersChange(filters.filter((_, idx) => idx !== i));
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Parametreler Bölümü */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Parametreler
              <Badge variant="secondary" className="text-[10px] ml-1">{parameters.length}</Badge>
            </span>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={addParameter}>
              <Plus className="h-3 w-3" />
              Parametre Ekle
            </Button>
          </div>

          {parameters.length === 0 ? (
            <div className="border border-dashed rounded-lg p-4 text-center">
              <SlidersHorizontal className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Henüz parametre tanımlanmamış</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Widget davranışını kontrol eden parametreler ekleyin</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {parameters.map((p, i) => (
                <FilterItemEditor
                  key={i}
                  item={p}
                  typeOptions={PARAM_TYPES}
                  onChange={(updated) => {
                    const newParams = [...parameters];
                    newParams[i] = updated as WidgetParamDef;
                    onParametersChange(newParams);
                  }}
                  onDelete={() => {
                    onParametersChange(parameters.filter((_, idx) => idx !== i));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
