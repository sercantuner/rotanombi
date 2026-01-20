// DateRangeConfig - Widget Builder için tarih filtresi yapılandırması

import React from 'react';
import { DateFilterConfig, DatePeriod, DATE_PERIODS } from '@/lib/widgetBuilderTypes';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CalendarClock, CalendarDays, CalendarRange, Infinity, Settings2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangeConfigProps {
  config: DateFilterConfig;
  onChange: (config: DateFilterConfig) => void;
  availableDateFields: string[];
  className?: string;
}

// Icon renderer
const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon className={className} /> : <Calendar className={className} />;
};

export function DateRangeConfig({
  config,
  onChange,
  availableDateFields,
  className
}: DateRangeConfigProps) {
  const handleChange = (key: keyof DateFilterConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const handlePeriodToggle = (periodId: DatePeriod) => {
    const current = config.allowedPeriods || DATE_PERIODS.map(p => p.id);
    const updated = current.includes(periodId)
      ? current.filter(p => p !== periodId)
      : [...current, periodId];
    handleChange('allowedPeriods', updated);
  };

  const isPeriodAllowed = (periodId: DatePeriod) => {
    if (!config.allowedPeriods) return true;
    return config.allowedPeriods.includes(periodId);
  };

  // Tarih alanlarını filtrele
  const dateFields = availableDateFields.filter(f => 
    f.toLowerCase().includes('tarih') || 
    f.toLowerCase().includes('date') ||
    f.toLowerCase().includes('zaman') ||
    f.toLowerCase().includes('time')
  );

  // Tüm alanları göster eğer tarih alanı bulunamazsa
  const fieldsToShow = dateFields.length > 0 ? dateFields : availableDateFields;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Tarih Filtresi</CardTitle>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
          />
        </div>
        <CardDescription>
          Widget verilerini tarih/dönem bazlı filtreleme
        </CardDescription>
      </CardHeader>

      {config.enabled && (
        <CardContent className="space-y-4">
          {/* Tarih Alanı Seçimi */}
          <div className="space-y-2">
            <Label className="text-sm">Tarih Alanı</Label>
            <Select
              value={config.dateField}
              onValueChange={(value) => handleChange('dateField', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrelenecek tarih alanını seçin" />
              </SelectTrigger>
              <SelectContent>
                {fieldsToShow.length > 0 ? (
                  fieldsToShow.map(field => (
                    <SelectItem key={field} value={field}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {field}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    API testi yaparak alanları görüntüleyin
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              API yanıtındaki tarih alanı (ör: kayittarihi, faturatarihi)
            </p>
          </div>

          {/* Varsayılan Periyot */}
          <div className="space-y-2">
            <Label className="text-sm">Varsayılan Periyot</Label>
            <Select
              value={config.defaultPeriod}
              onValueChange={(value) => handleChange('defaultPeriod', value as DatePeriod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PERIODS.filter(p => isPeriodAllowed(p.id)).map(period => (
                  <SelectItem key={period.id} value={period.id}>
                    <div className="flex items-center gap-2">
                      <IconComponent name={period.icon} className="h-3.5 w-3.5" />
                      {period.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* İzin Verilen Periyotlar */}
          <div className="space-y-3">
            <Label className="text-sm">İzin Verilen Periyotlar</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DATE_PERIODS.map(period => (
                <div
                  key={period.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                    isPeriodAllowed(period.id)
                      ? "border-primary/50 bg-primary/5"
                      : "border-muted bg-muted/20 opacity-60"
                  )}
                  onClick={() => handlePeriodToggle(period.id)}
                >
                  <Checkbox
                    checked={isPeriodAllowed(period.id)}
                    onCheckedChange={() => handlePeriodToggle(period.id)}
                    className="h-3.5 w-3.5"
                  />
                  <IconComponent name={period.icon} className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{period.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Widget Üzerinde Göster */}
          <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Widget Üzerinde Göster</p>
                <p className="text-xs text-muted-foreground">
                  Kullanıcı widget'ta periyot seçebilsin
                </p>
              </div>
            </div>
            <Switch
              checked={config.showInWidget}
              onCheckedChange={(checked) => handleChange('showInWidget', checked)}
            />
          </div>

          {/* Önizleme */}
          {config.showInWidget && config.dateField && (
            <div className="p-3 rounded border bg-muted/20">
              <p className="text-xs text-muted-foreground mb-2">Önizleme:</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background text-sm">
                <Calendar className="h-4 w-4" />
                {DATE_PERIODS.find(p => p.id === config.defaultPeriod)?.name || 'Bu Ay'}
                <span className="text-muted-foreground">▼</span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Varsayılan config
export const getDefaultDateFilterConfig = (): DateFilterConfig => ({
  enabled: false,
  dateField: '',
  defaultPeriod: 'this_month',
  allowedPeriods: ['all', 'today', 'this_week', 'this_month', 'this_quarter', 'this_year', 'custom'],
  showInWidget: true,
});
