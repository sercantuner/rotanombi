// Filter Sidebar - Yan filtre paneli bileşeni
import React, { useState } from 'react';
import { 
  Filter, X, Calendar, Users, MapPin, Tag, Package, 
  Building2, Warehouse, RotateCcw, Save, Lock, ChevronDown, ChevronUp 
} from 'lucide-react';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DatePeriod, datePeriodLabels, cariKartTipiLabels } from '@/lib/filterTypes';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FilterSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export function FilterSidebar({ isOpen = true, onClose, className }: FilterSidebarProps) {
  const {
    filters,
    filterOptions,
    setFilter,
    toggleArrayFilter,
    clearFilters,
    activeFilterCount,
    savePreset,
    presets,
    loadPreset,
  } = useGlobalFilters();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tarih: true,
    temsilci: true,
    konum: false,
    kategori: false,
  });

  const [presetName, setPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setIsSaving(true);
    try {
      await savePreset(presetName);
      setPresetName('');
    } finally {
      setIsSaving(false);
    }
  };

  // Kilitli filtreler
  const lockedFilters = filters._diaAutoFilters.filter(f => f.isLocked);
  const hasLockedSalesRep = lockedFilters.some(f => f.field === 'satiselemani');

  if (!isOpen) return null;

  return (
    <div className={cn(
      'w-72 bg-card border-r border-border flex flex-col h-full',
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Filtreler</h2>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Locked Filters Warning */}
          {lockedFilters.length > 0 && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-center gap-2 text-warning text-sm font-medium mb-2">
                <Lock className="w-4 h-4" />
                Kilitli Filtreler
              </div>
              <div className="space-y-1">
                {lockedFilters.map((f, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground">
                    {f.label || `${f.field}: ${f.value}`}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Bu filtreler DIA yetkinize göre otomatik uygulanır.
              </p>
            </div>
          )}

          {/* Tarih Filtresi */}
          <Collapsible open={expandedSections.tarih} onOpenChange={() => toggleSection('tarih')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Tarih Aralığı</span>
              </div>
              {expandedSections.tarih ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Select
                value={filters.tarihAraligi?.period || 'all'}
                onValueChange={(value: DatePeriod) => {
                  if (value === 'all') {
                    setFilter('tarihAraligi', null);
                  } else {
                    setFilter('tarihAraligi', { period: value, field: 'tarih' });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tarih seçin" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(datePeriodLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          {/* Satış Temsilcisi */}
          <Collapsible open={expandedSections.temsilci} onOpenChange={() => toggleSection('temsilci')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-success" />
                <span className="font-medium text-sm">Satış Temsilcisi</span>
                {filters.satisTemsilcisi.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {filters.satisTemsilcisi.length}
                  </Badge>
                )}
              </div>
              {expandedSections.temsilci ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {hasLockedSalesRep ? (
                <div className="p-2 rounded bg-muted text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  {lockedFilters.find(f => f.field === 'satiselemani')?.label}
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filterOptions.satisTemsilcileri.map((rep) => (
                    <label
                      key={rep}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.satisTemsilcisi.includes(rep)}
                        onCheckedChange={() => toggleArrayFilter('satisTemsilcisi', rep)}
                      />
                      <span className="text-sm">{rep}</span>
                    </label>
                  ))}
                  {filterOptions.satisTemsilcileri.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">
                      Temsilci bulunamadı
                    </p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Cari Kart Tipi */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2">
              <Tag className="w-4 h-4 text-accent" />
              <span className="font-medium text-sm">Cari Kart Tipi</span>
            </div>
            <div className="space-y-1">
              {['AL', 'AS', 'ST'].map((tip) => (
                <label
                  key={tip}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={filters.cariKartTipi.includes(tip)}
                    onCheckedChange={() => toggleArrayFilter('cariKartTipi', tip)}
                  />
                  <span className="text-sm">{cariKartTipiLabels[tip]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Konum Filtresi */}
          <Collapsible open={expandedSections.konum} onOpenChange={() => toggleSection('konum')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-destructive" />
                <span className="font-medium text-sm">Konum</span>
                {filters.sehir.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {filters.sehir.length}
                  </Badge>
                )}
              </div>
              {expandedSections.konum ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filterOptions.sehirler.map((sehir) => (
                  <label
                    key={sehir}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.sehir.includes(sehir)}
                      onCheckedChange={() => toggleArrayFilter('sehir', sehir)}
                    />
                    <span className="text-sm">{sehir}</span>
                  </label>
                ))}
                {filterOptions.sehirler.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    Şehir bulunamadı
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Şube ve Depo */}
          {(filterOptions.subeler.length > 0 || filterOptions.depolar.length > 0) && (
            <Collapsible open={expandedSections.kategori} onOpenChange={() => toggleSection('kategori')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Şube / Depo</span>
                </div>
                {expandedSections.kategori ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                {filterOptions.subeler.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 px-2">Şube</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {filterOptions.subeler.map((sube) => (
                        <label
                          key={sube.value}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={filters.sube.includes(sube.value)}
                            onCheckedChange={() => toggleArrayFilter('sube', sube.value)}
                          />
                          <span className="text-sm">{sube.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.depolar.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 px-2">Depo</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {filterOptions.depolar.map((depo) => (
                        <label
                          key={depo.value}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={filters.depo.includes(depo.value)}
                            onCheckedChange={() => toggleArrayFilter('depo', depo.value)}
                          />
                          <span className="text-sm">{depo.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Preset Kaydet */}
          {activeFilterCount > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">Filtreleri kaydet</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Preset adı..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim() || isSaving}
                >
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Kaydedilmiş Presetler */}
          {presets.length > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">Kayıtlı filtreler</p>
              <div className="space-y-1">
                {presets.slice(0, 5).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    className="w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
        >
          <RotateCcw className="w-4 h-4" />
          Filtreleri Sıfırla
        </Button>
      </div>
    </div>
  );
}
