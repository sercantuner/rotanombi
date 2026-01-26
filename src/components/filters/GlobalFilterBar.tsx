// Global Filter Bar - Üst filtre barı bileşeni
import React, { useState } from 'react';
import { Search, Calendar, Users, Filter, X, ChevronDown, Save, RotateCcw } from 'lucide-react';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePeriod, datePeriodLabels, cariKartTipiLabels } from '@/lib/filterTypes';
import { cn } from '@/lib/utils';

interface GlobalFilterBarProps {
  showSearch?: boolean;
  showDateFilter?: boolean;
  showSalesRepFilter?: boolean;
  showCardTypeFilter?: boolean;
  className?: string;
  compact?: boolean;
}

export function GlobalFilterBar({
  showSearch = true,
  showDateFilter = true,
  showSalesRepFilter = true,
  showCardTypeFilter = true,
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

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [salesRepPopoverOpen, setSalesRepPopoverOpen] = useState(false);

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

  // Seçili satış temsilcisi sayısı
  const selectedSalesRepCount = filters.satisTemsilcisi.length;
  
  // Kilitli filtre var mı kontrol et
  const hasLockedSalesRep = filters._diaAutoFilters.some(f => f.field === 'satiselemani');
  const lockedSalesRep = filters._diaAutoFilters.find(f => f.field === 'satiselemani');

  return (
    <div className={cn(
      'glass-card rounded-xl p-3 animate-fade-in',
      compact ? 'p-2' : 'p-3 md:p-4',
      className
    )}>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hızlı ara..."
              value={filters.searchTerm}
              onChange={(e) => setFilter('searchTerm', e.target.value)}
              className={cn('pl-9', compact ? 'h-8 text-sm' : 'h-9')}
            />
          </div>
        )}

        {/* Date Filter */}
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

        {/* Sales Rep Filter */}
        {showSalesRepFilter && (
          <Popover open={salesRepPopoverOpen} onOpenChange={setSalesRepPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size={compact ? 'sm' : 'default'}
                className={cn(
                  'gap-2',
                  (selectedSalesRepCount > 0 || hasLockedSalesRep) && 'border-success bg-success/5'
                )}
                disabled={hasLockedSalesRep}
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {hasLockedSalesRep 
                    ? `🔒 ${lockedSalesRep?.label || lockedSalesRep?.value}`
                    : selectedSalesRepCount > 0 
                      ? `${selectedSalesRepCount} Temsilci`
                      : 'Tüm Temsilciler'
                  }
                </span>
                {!hasLockedSalesRep && <ChevronDown className="w-3 h-3 opacity-50" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filterOptions.satisTemsilcileri.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Temsilci bulunamadı
                  </p>
                ) : (
                  filterOptions.satisTemsilcileri.map((rep) => (
                    <label
                      key={rep}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.satisTemsilcisi.includes(rep)}
                        onCheckedChange={() => toggleArrayFilter('satisTemsilcisi', rep)}
                      />
                      <span className="text-sm">{rep}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedSalesRepCount > 0 && (
                <div className="border-t mt-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setFilter('satisTemsilcisi', [])}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Temizle
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Card Type Filter (AL/AS/ST) */}
        {showCardTypeFilter && (
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

          {filters.searchTerm && (
            <Badge variant="secondary" className="gap-1 pr-1">
              🔍 "{filters.searchTerm}"
              <button 
                onClick={() => setFilter('searchTerm', '')}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          
          {/* Locked DIA filters */}
          {filters._diaAutoFilters.map((f, idx) => (
            <Badge key={idx} variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/30">
              🔒 {f.label || f.value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
