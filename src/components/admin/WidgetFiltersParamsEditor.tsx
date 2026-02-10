// Widget Filtre ve Parametre Görsel Editörü - v2
// 3 bölüm: Parametreler (koddan parse) + AI Asistanı + Filtreler (alan seçimli)

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Filter, SlidersHorizontal, GripVertical, ChevronDown, ChevronUp, Sparkles, Loader2, Search, Tag, X, Hash, Calendar, Type, ToggleLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetFilterDef, WidgetParamDef } from '@/lib/widgetBuilderTypes';
import { supabase } from '@/integrations/supabase/client';

// ─── Parametre Tip Seçenekleri ───
const PARAM_TYPES = [
  { value: 'dropdown', label: 'Açılır Liste' },
  { value: 'toggle', label: 'Aç/Kapa' },
  { value: 'number', label: 'Sayı' },
  { value: 'text', label: 'Metin' },
  { value: 'range', label: 'Aralık' },
];

// ─── Alan Tipi Tespit ───
const detectFieldType = (fieldName: string): 'string' | 'number' | 'date' | 'boolean' => {
  const l = fieldName.toLowerCase();
  if (l.includes('tarih') || l.includes('date') || l.includes('_at') || l.includes('zaman')) return 'date';
  if (l.includes('tutar') || l.includes('bakiye') || l.includes('miktar') || l.includes('fiyat') || l.includes('adet') || l.includes('toplam') || l.includes('oran')) return 'number';
  if (l.includes('is_') || l.includes('has_') || l.includes('aktif') || l.includes('durum')) return 'boolean';
  return 'string';
};

const generateDefaultLabel = (fieldName: string): string =>
  fieldName.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

const FieldTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'number': return <Hash className="h-3 w-3" />;
    case 'date': return <Calendar className="h-3 w-3" />;
    case 'boolean': return <ToggleLeft className="h-3 w-3" />;
    default: return <Type className="h-3 w-3" />;
  }
};

// ─── AI Parametre Önerisi Tipi ───
interface AISuggestion {
  key: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  reason: string;
}

// ─── Parametre Satır Editörü ───
function ParamItemEditor({ item, onChange, onDelete }: {
  item: WidgetParamDef;
  onChange: (item: WidgetParamDef) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsOptions = item.type === 'dropdown';
  const [newOptValue, setNewOptValue] = useState('');
  const [newOptLabel, setNewOptLabel] = useState('');

  return (
    <div className="border rounded-lg p-2.5 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input value={item.key} onChange={(e) => onChange({ ...item, key: e.target.value.replace(/\s/g, '') })} className="h-6 text-xs font-mono flex-1" placeholder="key" />
        <Input value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} className="h-6 text-xs flex-1" placeholder="Etiket" />
        <Select value={item.type} onValueChange={(val) => onChange({ ...item, type: val as any })}>
          <SelectTrigger className="h-6 text-xs w-24 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARAM_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1 pl-6">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-24">Mobilde Göster:</Label>
            <Switch checked={item.showOnMobile ?? false} onCheckedChange={(val) => onChange({ ...item, showOnMobile: val })} />
          </div>
          {item.type === 'toggle' ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24">Varsayılan:</Label>
              <Switch checked={item.defaultValue ?? false} onCheckedChange={(val) => onChange({ ...item, defaultValue: val })} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24">Varsayılan:</Label>
              <Input value={item.defaultValue ?? ''} onChange={(e) => onChange({ ...item, defaultValue: e.target.value || undefined })} className="h-6 text-xs flex-1" placeholder="Boş bırakılabilir" />
            </div>
          )}

          {(item.type === 'range' || item.type === 'number') && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24">Min / Max:</Label>
              <Input type="number" value={item.min ?? ''} onChange={(e) => onChange({ ...item, min: e.target.value ? Number(e.target.value) : undefined })} className="h-6 text-xs w-20" placeholder="Min" />
              <span className="text-xs text-muted-foreground">—</span>
              <Input type="number" value={item.max ?? ''} onChange={(e) => onChange({ ...item, max: e.target.value ? Number(e.target.value) : undefined })} className="h-6 text-xs w-20" placeholder="Max" />
            </div>
          )}

          {needsOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Seçenekler:</Label>
              <div className="flex flex-wrap gap-1">
                {(item.options || []).map((opt, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => { const o = [...(item.options || [])]; o.splice(i, 1); onChange({ ...item, options: o }); }}>
                    {opt.label} ({opt.value}) <Trash2 className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Input value={newOptValue} onChange={(e) => setNewOptValue(e.target.value)} className="h-6 text-xs flex-1" placeholder="Değer" />
                <Input value={newOptLabel} onChange={(e) => setNewOptLabel(e.target.value)} className="h-6 text-xs flex-1" placeholder="Etiket" />
                <Button variant="secondary" size="icon" className="h-6 w-6 shrink-0" disabled={!newOptValue.trim()}
                  onClick={() => {
                    onChange({ ...item, options: [...(item.options || []), { value: newOptValue.trim(), label: newOptLabel.trim() || newOptValue.trim() }] });
                    setNewOptValue(''); setNewOptLabel('');
                  }}>
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

// ─── Filtre Alan Seçici (WidgetFilterFieldsBuilder entegre) ───
interface FilterFieldConfig {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

function FilterFieldSelector({ availableFields, selectedFields, onChange }: {
  availableFields: string[];
  selectedFields: FilterFieldConfig[];
  onChange: (fields: FilterFieldConfig[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState('');

  const selectedKeys = useMemo(() => selectedFields.map(f => f.key), [selectedFields]);

  const filteredAvailable = useMemo(() =>
    availableFields
      .filter(f => !selectedKeys.includes(f))
      .filter(f => !searchTerm || f.toLowerCase().includes(searchTerm.toLowerCase()) || generateDefaultLabel(f).toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'tr')),
    [availableFields, selectedKeys, searchTerm]
  );

  const addField = (fieldName: string) => {
    onChange([...selectedFields, { key: fieldName, label: generateDefaultLabel(fieldName), type: detectFieldType(fieldName) }]);
  };

  const removeField = (key: string) => onChange(selectedFields.filter(f => f.key !== key));

  const saveLabel = () => {
    if (editingLabel && tempLabel.trim()) {
      onChange(selectedFields.map(f => f.key === editingLabel ? { ...f, label: tempLabel.trim() } : f));
    }
    setEditingLabel(null);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Sol: Mevcut Alanlar */}
      <div className="border rounded-lg p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Tag className="h-3 w-3" /> Mevcut Alanlar
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input placeholder="Alan ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-7 h-7 text-xs" />
        </div>
        <ScrollArea className="h-[180px]">
          <div className="space-y-0.5 pr-1">
            {filteredAvailable.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">{searchTerm ? 'Bulunamadı' : 'Tümü eklendi'}</p>
            ) : filteredAvailable.map(field => (
              <button key={field} type="button" onClick={() => addField(field)}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted text-xs group">
                <FieldTypeIcon type={detectFieldType(field)} />
                <span className="flex-1 text-left truncate">{field}</span>
                <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Sağ: Seçili Filtre Alanları */}
      <div className="border rounded-lg p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3 w-3" /> Seçili Filtreler
          {selectedFields.length > 0 && <Badge variant="secondary" className="text-[10px] ml-auto">{selectedFields.length}</Badge>}
        </div>
        <ScrollArea className="h-[210px]">
          <div className="space-y-1 pr-1">
            {selectedFields.length === 0 ? (
              <div className="text-center py-6">
                <Filter className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground">Sol panelden alan seçin</p>
              </div>
            ) : selectedFields.map(field => (
              <div key={field.key} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 border">
                <FieldTypeIcon type={field.type || 'string'} />
                <div className="flex-1 min-w-0">
                  {editingLabel === field.key ? (
                    <Input value={tempLabel} onChange={(e) => setTempLabel(e.target.value)} onBlur={saveLabel} onKeyDown={(e) => e.key === 'Enter' && saveLabel()} className="h-5 text-xs" autoFocus />
                  ) : (
                    <button type="button" onClick={() => { setEditingLabel(field.key); setTempLabel(field.label); }} className="w-full text-left">
                      <span className="text-xs font-medium block truncate">{field.label}</span>
                      <span className="text-[10px] text-muted-foreground block truncate">{field.key}</span>
                    </button>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeField(field.key)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ───
interface WidgetFiltersParamsEditorProps {
  filters: WidgetFilterDef[];
  parameters: WidgetParamDef[];
  onFiltersChange: (filters: WidgetFilterDef[]) => void;
  onParametersChange: (params: WidgetParamDef[]) => void;
  customCode?: string;
  availableFields?: string[];
}

export function WidgetFiltersParamsEditor({ filters, parameters, onFiltersChange, onParametersChange, customCode, availableFields = [] }: WidgetFiltersParamsEditorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // ─── Parametre Ekleme ───
  const addParameter = () => {
    const newKey = `param_${parameters.length + 1}`;
    onParametersChange([...parameters, { key: newKey, label: 'Yeni Parametre', type: 'dropdown', options: [] }]);
  };

  // ─── AI Parametre Önerisi ───
  const suggestParameters = async () => {
    if (!customCode) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke('ai-code-generator', {
        body: {
          prompt: customCode,
          mode: 'suggest-params',
          existingCode: customCode,
          sampleData: [],
          chatHistory: [],
        }
      });

      if (error) throw error;
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        // Zaten tanımlı parametreleri filtrele
        const existingKeys = parameters.map(p => p.key);
        const newSuggestions = data.suggestions.filter((s: AISuggestion) => !existingKeys.includes(s.key));
        setAiSuggestions(newSuggestions);
        if (newSuggestions.length === 0) {
          setAiError('Kod analiz edildi, yeni parametre önerisi bulunamadı.');
        }
      } else {
        setAiError('AI yanıtı beklenmeyen formatta.');
      }
    } catch (err: any) {
      console.error('AI suggest-params hatası:', err);
      setAiError(err.message || 'AI servisi hatası');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── AI Önerisini Parametre Olarak Ekle ───
  const addSuggestion = (suggestion: AISuggestion) => {
    const newParam: WidgetParamDef = {
      key: suggestion.key,
      label: suggestion.label,
      type: suggestion.type as any,
      options: suggestion.options,
      defaultValue: suggestion.defaultValue,
    };
    onParametersChange([...parameters, newParam]);
    setAiSuggestions(prev => prev.filter(s => s.key !== suggestion.key));
  };

  // ─── Filtre alanlarını FilterFieldConfig'e dönüştür ───
  const filterFieldConfigs = useMemo(() =>
    filters.map(f => ({ key: f.key, label: f.label, type: detectFieldType(f.key) as any })),
    [filters]
  );

  const handleFilterFieldsChange = (fields: { key: string; label: string; type?: string }[]) => {
    // FilterFieldConfig → WidgetFilterDef dönüşümü
    const newFilters: WidgetFilterDef[] = fields.map(f => {
      const existing = filters.find(ef => ef.key === f.key);
      if (existing) return { ...existing, label: f.label };
      // Yeni alan → otomatik tip tespit
      const fieldType = f.type || detectFieldType(f.key);
      let filterType: WidgetFilterDef['type'] = 'multi-select';
      if (fieldType === 'number') filterType = 'range';
      else if (fieldType === 'date') filterType = 'date-range';
      else if (fieldType === 'boolean') filterType = 'toggle';
      return { key: f.key, label: f.label, type: filterType };
    });
    onFiltersChange(newFilters);
  };

  return (
    <TooltipProvider>
      <ScrollArea className="h-full">
        <div className="space-y-4 p-1">

          {/* ═══ 1. PARAMETRELER ═══ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Parametreler
                <Badge variant="secondary" className="text-[10px] ml-1">{parameters.length}</Badge>
              </span>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={addParameter}>
                <Plus className="h-3 w-3" /> Parametre Ekle
              </Button>
            </div>

            {parameters.length === 0 ? (
              <div className="border border-dashed rounded-lg p-3 text-center">
                <SlidersHorizontal className="h-5 w-5 mx-auto mb-1 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Henüz parametre tanımlanmamış</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Widget davranışını kontrol eden parametreler ekleyin</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {parameters.map((p, i) => (
                  <ParamItemEditor
                    key={`${p.key}-${i}`}
                    item={p}
                    onChange={(updated) => {
                      const newParams = [...parameters];
                      newParams[i] = updated;
                      onParametersChange(newParams);
                    }}
                    onDelete={() => onParametersChange(parameters.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ═══ 2. AI PARAMETRE ASİSTANI ═══ */}
          {customCode && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Parametre Asistanı
                  </span>
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={suggestParameters} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiLoading ? 'Analiz ediliyor...' : 'Kodu Analiz Et'}
                  </Button>
                </div>

                {aiError && (
                  <Alert className="py-2">
                    <AlertDescription className="text-[10px]">{aiError}</AlertDescription>
                  </Alert>
                )}

                {aiSuggestions.length > 0 && (
                  <div className="space-y-1.5">
                    {aiSuggestions.map((s, i) => (
                      <div key={i} className="border rounded-lg p-2 bg-primary/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono">{s.key}</Badge>
                            <span className="text-xs font-medium">{s.label}</span>
                            <Badge variant="secondary" className="text-[10px]">{s.type}</Badge>
                          </div>
                          <Button variant="outline" size="sm" className="h-5 text-[10px] gap-1" onClick={() => addSuggestion(s)}>
                            <Plus className="h-2.5 w-2.5" /> Ekle
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                        {s.options && s.options.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {s.options.map((o, oi) => (
                              <Badge key={oi} variant="secondary" className="text-[10px]">{o.label}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!aiLoading && aiSuggestions.length === 0 && !aiError && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    "Kodu Analiz Et" butonuna basarak AI'dan parametre önerisi alın
                  </p>
                )}
              </div>
            </>
          )}

          {/* ═══ 3. FİLTRELER (Alan Seçimli) ═══ */}
          <Separator />
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filtreler
              <Badge variant="secondary" className="text-[10px] ml-1">{filters.length}</Badge>
            </span>

            {availableFields.length > 0 ? (
              <FilterFieldSelector
                availableFields={availableFields}
                selectedFields={filterFieldConfigs}
                onChange={handleFilterFieldsChange}
              />
            ) : (
              <div className="border border-dashed rounded-lg p-3 text-center">
                <Filter className="h-5 w-5 mx-auto mb-1 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Veri kaynağı alanları yüklenmedi</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Veri kaynağı seçili olduğunda alanlar burada listelenecek</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
