// WidgetDateFilter - Widget üzerinde tarih periyodu seçici

import React, { useState } from 'react';
import { DateFilterConfig, DatePeriod, DATE_PERIODS } from '@/lib/widgetBuilderTypes';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar as CalendarIcon, 
  ChevronDown,
  Check
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subWeeks, subMonths, subQuarters, subYears } from 'date-fns';
import { tr } from 'date-fns/locale';

interface WidgetDateFilterProps {
  config: DateFilterConfig;
  currentPeriod: DatePeriod;
  onPeriodChange: (period: DatePeriod, dateRange?: { start: Date; end: Date }) => void;
  className?: string;
  compact?: boolean;
}

// Icon renderer
const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon className={className} /> : <CalendarIcon className={className} />;
};

// Tarih aralığı hesaplama
export function getDateRangeForPeriod(period: DatePeriod): { start: Date; end: Date } | null {
  const now = new Date();
  
  switch (period) {
    case 'all':
      return null;
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last_week':
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    case 'last_7_days':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'last_30_days':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case 'last_90_days':
      return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'last_quarter':
      const lastQuarter = subQuarters(now, 1);
      return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) };
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'last_year':
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    default:
      return null;
  }
}

export function WidgetDateFilter({
  config,
  currentPeriod,
  onPeriodChange,
  className,
  compact = false
}: WidgetDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);

  // İzin verilen periyotlar
  const allowedPeriods = config.allowedPeriods || DATE_PERIODS.map(p => p.id);
  const visiblePeriods = DATE_PERIODS.filter(p => allowedPeriods.includes(p.id));

  const currentPeriodInfo = DATE_PERIODS.find(p => p.id === currentPeriod);

  const handlePeriodSelect = (period: DatePeriod) => {
    if (period === 'custom') {
      setShowCustomCalendar(true);
      return;
    }
    
    const dateRange = getDateRangeForPeriod(period);
    onPeriodChange(period, dateRange || undefined);
    setOpen(false);
    setShowCustomCalendar(false);
  };

  const handleCustomRangeApply = () => {
    if (customRange.from && customRange.to) {
      onPeriodChange('custom', { 
        start: startOfDay(customRange.from), 
        end: endOfDay(customRange.to) 
      });
      setOpen(false);
      setShowCustomCalendar(false);
    }
  };

  const getDisplayText = () => {
    if (currentPeriod === 'custom' && customRange.from && customRange.to) {
      return `${format(customRange.from, 'dd MMM', { locale: tr })} - ${format(customRange.to, 'dd MMM', { locale: tr })}`;
    }
    return currentPeriodInfo?.name || 'Dönem Seç';
  };

  if (!config.enabled || !config.showInWidget) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            "gap-2",
            compact && "h-7 px-2 text-xs",
            className
          )}
        >
          <CalendarIcon className={cn("text-muted-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
          <span className="truncate max-w-[120px]">{getDisplayText()}</span>
          <ChevronDown className={cn("text-muted-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {showCustomCalendar ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Özel Aralık</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowCustomCalendar(false)}
              >
                Geri
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={{ from: customRange.from, to: customRange.to }}
              onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
              locale={tr}
              numberOfMonths={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCustomCalendar(false)}>
                İptal
              </Button>
              <Button 
                size="sm" 
                onClick={handleCustomRangeApply}
                disabled={!customRange.from || !customRange.to}
              >
                Uygula
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {visiblePeriods.map((period, index) => {
              // Özel aralık öncesinde separator ekle
              const showSeparator = period.id === 'custom' && index > 0;
              
              return (
                <React.Fragment key={period.id}>
                  {showSeparator && <Separator className="my-1" />}
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                      currentPeriod === period.id && "bg-primary/10 text-primary"
                    )}
                    onClick={() => handlePeriodSelect(period.id)}
                  >
                    <IconComponent name={period.icon} className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{period.name}</span>
                    {currentPeriod === period.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
