// Date Range Filter - Tarih aralığı filtre bileşeni
import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
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
import { DatePeriod, DateRangeFilter as DateRangeFilterType, datePeriodLabels } from '@/lib/filterTypes';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface DateRangeFilterProps {
  value: DateRangeFilterType | null;
  onChange: (value: DateRangeFilterType | null) => void;
  dateField?: string;
  className?: string;
  showCustomRange?: boolean;
  compact?: boolean;
}

export function DateRangeFilter({
  value,
  onChange,
  dateField = 'tarih',
  className,
  showCustomRange = true,
  compact = false,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const handlePeriodChange = (period: DatePeriod) => {
    if (period === 'all') {
      onChange(null);
      setIsOpen(false);
    } else if (period === 'custom') {
      setShowCustomPicker(true);
    } else {
      onChange({
        period,
        field: dateField,
      });
      setIsOpen(false);
    }
  };

  const handleCustomRangeApply = () => {
    if (customStartDate && customEndDate) {
      onChange({
        period: 'custom',
        field: dateField,
        customStart: format(customStartDate, 'yyyy-MM-dd'),
        customEnd: format(customEndDate, 'yyyy-MM-dd'),
      });
      setShowCustomPicker(false);
      setIsOpen(false);
    }
  };

  const currentLabel = value 
    ? (value.period === 'custom' && value.customStart && value.customEnd
        ? `${format(new Date(value.customStart), 'dd MMM', { locale: tr })} - ${format(new Date(value.customEnd), 'dd MMM', { locale: tr })}`
        : datePeriodLabels[value.period])
    : 'Tüm Tarihler';

  const quickPeriods: DatePeriod[] = [
    'all', 'today', 'this_week', 'this_month', 'this_quarter', 'this_year',
    'last_week', 'last_month', 'last_30_days', 'last_90_days',
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={cn(
            'gap-2 justify-between',
            value && 'border-primary bg-primary/5',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{currentLabel}</span>
          </div>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {!showCustomPicker ? (
          <div className="p-2 space-y-1">
            {quickPeriods.map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  value?.period === period || (!value && period === 'all')
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                {datePeriodLabels[period]}
              </button>
            ))}
            {showCustomRange && (
              <>
                <div className="my-2 border-t" />
                <button
                  onClick={() => handlePeriodChange('custom')}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    value?.period === 'custom'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  📅 Özel Aralık...
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Başlangıç</p>
                <CalendarComponent
                  mode="single"
                  selected={customStartDate}
                  onSelect={setCustomStartDate}
                  locale={tr}
                  className="rounded-md border"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Bitiş</p>
                <CalendarComponent
                  mode="single"
                  selected={customEndDate}
                  onSelect={setCustomEndDate}
                  locale={tr}
                  className="rounded-md border"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomPicker(false)}
              >
                İptal
              </Button>
              <Button
                size="sm"
                onClick={handleCustomRangeApply}
                disabled={!customStartDate || !customEndDate}
              >
                Uygula
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
