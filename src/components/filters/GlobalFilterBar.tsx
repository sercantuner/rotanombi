// Global Filter Bar - Üst filtre barı bileşeni (Dinamik filtre yönetimi)
import React, { useState } from 'react';
import { Calendar, Users, Filter, X, ChevronDown, RotateCcw, Settings2, Lock, Building2, Warehouse, MapPin, Hash, Tag } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { useFilterPreferences, ALL_AVAILABLE_FILTERS } from '@/hooks/useFilterPreferences';
import { FilterManagerModal } from './FilterManagerModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePeriod, datePeriodLabels, cariKartTipiLabels } from '@/lib/filterTypes';
import { cn } from '@/lib/utils';

interface GlobalFilterBarProps {
  showDateFilter?: boolean;
  className?: string;
  compact?: boolean;
}

// Dinamik ikon
const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (LucideIcons as any)[name] || Filter;
  return <Icon className={className} />;
};

export function GlobalFilterBar({
  showDateFilter = true,
  className,
  compact = false,
}: GlobalFilterBarProps) {
  const {
    filters,
    filterOptions,
    setFilter,
    toggleArrayFilter,
    clearFilters,
    activeFilterCount,
  } = useGlobalFilters();

  const { preferences, savePreferences, isFilterVisible, isLoading: prefsLoading } = useFilterPreferences();
  
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [activePopover, setActivePopover] = useState<string | null>(null);

  // Kilitli filtre var mı kontrol et
  const hasLockedSalesRep = filters._diaAutoFilters.some(f => f.field === 'satiselemani');
  const lockedSalesRep = filters._diaAutoFilters.find(f => f.field === 'satiselemani');

  // Tarih periyodu değiştir
  const handleDatePeriodChange = (period: DatePeriod) => {
    if (period === 'all') {
      setFilter('tarihAraligi', null);
    } else {
      setFilter('tarihAraligi', {
        period,
        field: 'tarih',
      });
    }
    setDatePopoverOpen(false);
  };

  // Mevcut tarih etiketi
  const currentDateLabel = filters.tarihAraligi 
    ? datePeriodLabels[filters.tarihAraligi.period] 
    : 'Tüm Tarihler';

  // Multi-select filtre render
  const renderMultiSelectFilter = (
    filterKey: keyof typeof filters,
    icon: React.ReactNode,
    label: string,
    options: string[],
    selectedValues: string[],
    isLocked?: boolean,
    lockedLabel?: string
  ) => {
    if (!isFilterVisible(filterKey as string)) return null;

    return (
      <Popover 
        key={filterKey as string}
        open={activePopover === filterKey} 
        onOpenChange={(open) => setActivePopover(open ? filterKey as string : null)}
      >
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size={compact ? 'sm' : 'default'}
            className={cn(
              'gap-2',
              (selectedValues.length > 0 || isLocked) && 'border-success bg-success/5'
            )}
            disabled={isLocked}
          >
            {icon}
            <span className="hidden sm:inline">
              {isLocked 
                ? `🔒 ${lockedLabel}`
                : selectedValues.length > 0 
                  ? `${selectedValues.length} ${label.split(' ')[0]}`
                  : `Tüm ${label}`
              }
            </span>
            {!isLocked && <ChevronDown className="w-3 h-3 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Seçenek bulunamadı
              </p>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedValues.includes(option)}
                    onCheckedChange={() => toggleArrayFilter(filterKey, option)}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))
            )}
          </div>
          {selectedValues.length > 0 && (
            <div className="border-t mt-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setFilter(filterKey, [] as any)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Temizle
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  // Filtre tercihlerini kaydet
  const handleSavePreferences = async (newFilters: string[]) => {
    await savePreferences({
      ...preferences,
      visibleFilters: newFilters,
    });
  };

  return (
    <>
      <div className={cn(
        'glass-card rounded-xl p-3 animate-fade-in',
        compact ? 'p-2' : 'p-3 md:p-4',
        className
      )}>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Date Filter - Her zaman görünür */}
          {showDateFilter && (
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size={compact ? 'sm' : 'default'}
                  className={cn(
                    'gap-2',
                    filters.tarihAraligi && 'border-primary bg-primary/5'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">{currentDateLabel}</span>
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {(['all', 'today', 'this_week', 'this_month', 'this_quarter', 'this_year', 'last_month', 'last_30_days'] as DatePeriod[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => handleDatePeriodChange(period)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        (filters.tarihAraligi?.period === period || (!filters.tarihAraligi && period === 'all'))
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      {datePeriodLabels[period]}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Satış Temsilcisi */}
          {renderMultiSelectFilter(
            'satisTemsilcisi',
            <Users className="w-4 h-4" />,
            'Temsilciler',
            filterOptions.satisTemsilcileri,
            filters.satisTemsilcisi,
            hasLockedSalesRep,
            lockedSalesRep?.label || lockedSalesRep?.value
          )}

          {/* Cari Kart Tipi (AL/AS/ST) */}
          {isFilterVisible('cariKartTipi') && (
            <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
              {['AL', 'AS', 'ST'].map((tip) => (
                <button
                  key={tip}
                  onClick={() => toggleArrayFilter('cariKartTipi', tip)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                    filters.cariKartTipi.includes(tip)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {cariKartTipiLabels[tip]}
                </button>
              ))}
            </div>
          )}

          {/* Şube */}
          {renderMultiSelectFilter(
            'sube',
            <Building2 className="w-4 h-4" />,
            'Şubeler',
            filterOptions.subeler.map(s => s.label),
            filters.sube
          )}

          {/* Depo */}
          {renderMultiSelectFilter(
            'depo',
            <Warehouse className="w-4 h-4" />,
            'Depolar',
            filterOptions.depolar.map(d => d.label),
            filters.depo
          )}

          {/* Şehir */}
          {renderMultiSelectFilter(
            'sehir',
            <MapPin className="w-4 h-4" />,
            'Şehirler',
            filterOptions.sehirler,
            filters.sehir
          )}

          {/* Özel Kod 1 */}
          {renderMultiSelectFilter(
            'ozelkod1',
            <Hash className="w-4 h-4" />,
            'Özel Kod 1',
            filterOptions.ozelkodlar1.map(o => o.label),
            filters.ozelkod1
          )}

          {/* Özel Kod 2 */}
          {renderMultiSelectFilter(
            'ozelkod2',
            <Hash className="w-4 h-4" />,
            'Özel Kod 2',
            filterOptions.ozelkodlar2.map(o => o.label),
            filters.ozelkod2
          )}

          {/* Özel Kod 3 */}
          {renderMultiSelectFilter(
            'ozelkod3',
            <Hash className="w-4 h-4" />,
            'Özel Kod 3',
            filterOptions.ozelkodlar3.map(o => o.label),
            filters.ozelkod3
          )}

          {/* Filtre Yönetimi Butonu */}
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            onClick={() => setManagerModalOpen(true)}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Filtreler</span>
          </Button>

          {/* Active Filter Count */}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Filter className="w-3 h-3" />
              {activeFilterCount}
            </Badge>
          )}

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <Button 
              variant="ghost" 
              size={compact ? 'sm' : 'default'}
              onClick={clearFilters}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Temizle</span>
            </Button>
          )}
        </div>

        {/* Active Filter Badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
            {filters.tarihAraligi && filters.tarihAraligi.period !== 'all' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                📅 {datePeriodLabels[filters.tarihAraligi.period]}
                <button 
                  onClick={() => setFilter('tarihAraligi', null)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            
            {filters.cariKartTipi.map((tip) => (
              <Badge key={tip} variant="secondary" className="gap-1 pr-1 bg-accent/20">
                {cariKartTipiLabels[tip]}
                <button 
                  onClick={() => toggleArrayFilter('cariKartTipi', tip)}
                  className="ml-1 hover:bg-accent/30 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            
            {filters.satisTemsilcisi.map((rep) => (
              <Badge key={rep} variant="secondary" className="gap-1 pr-1 bg-success/10 text-success">
                {rep}
                <button 
                  onClick={() => toggleArrayFilter('satisTemsilcisi', rep)}
                  className="ml-1 hover:bg-success/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}

            {filters.sube.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1 pr-1">
                🏢 {s}
                <button 
                  onClick={() => toggleArrayFilter('sube', s)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}

            {filters.depo.map((d) => (
              <Badge key={d} variant="secondary" className="gap-1 pr-1">
                📦 {d}
                <button 
                  onClick={() => toggleArrayFilter('depo', d)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}

            {filters.sehir.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1 pr-1">
                📍 {s}
                <button 
                  onClick={() => toggleArrayFilter('sehir', s)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            
            {/* Locked DIA filters */}
            {filters._diaAutoFilters.map((f, idx) => (
              <Badge key={idx} variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/30">
                <Lock className="w-3 h-3" />
                {f.label || f.value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Filtre Yönetimi Modal */}
      <FilterManagerModal
        open={managerModalOpen}
        onOpenChange={setManagerModalOpen}
        visibleFilters={preferences.visibleFilters}
        onSave={handleSavePreferences}
      />
    </>
  );
}
